import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const ALLOWED_ORIGINS = [
  "https://fidelipros.lovable.app",
  "https://id-preview--a602f3ee-5c8a-4025-8469-788fb1c1e4c8.lovable.app",
];
function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

  const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Webhook signature verification failed:", msg);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  console.log("Stripe event:", event.type);

  try {
    switch (event.type) {
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        const plan = sub.metadata?.plan;
        const customerId = sub.customer as string;
        if (userId) {
          const mappedStatus = sub.status === "active" ? "active"
            : sub.status === "trialing" ? "trialing"
            : "inactive";
          await supabase.from("businesses").update({
            subscription_status: mappedStatus,
            ...(plan ? { subscription_plan: plan } : {}),
            stripe_subscription_id: sub.id,
            stripe_customer_id: customerId,
          }).eq("owner_id", userId);
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        const plan = sub.metadata?.plan;
        const status = sub.status;
        const customerId = sub.customer as string;

        if (userId) {
          await supabase.from("businesses").update({
            subscription_status: status === "active" ? "active"
              : status === "past_due" ? "past_due"
              : status === "canceled" ? "canceled"
              : status === "trialing" ? "trialing"
              : "inactive",
            ...(plan ? { subscription_plan: plan } : {}),
            stripe_subscription_id: sub.id,
            stripe_customer_id: customerId,
          }).eq("owner_id", userId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (userId) {
          await supabase.from("businesses").update({
            subscription_status: "canceled",
            subscription_plan: null,
            stripe_subscription_id: null,
          }).eq("owner_id", userId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        if (customerId) {
          const { data: biz } = await supabase
            .from("businesses")
            .select("id, owner_id")
            .eq("stripe_customer_id", customerId)
            .maybeSingle();

          if (biz) {
            await supabase.from("businesses").update({
              subscription_status: "past_due",
            }).eq("id", biz.id);
          } else {
            const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
            if (customer.email) {
              const { data: user } = await supabase.auth.admin.getUserByEmail(customer.email);
              if (user?.user) {
                await supabase.from("businesses").update({
                  subscription_status: "past_due",
                }).eq("owner_id", user.user.id);
              }
            }
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = invoice.subscription as string;

        let bizId: string | null = null;
        let userId: string | null = null;

        const { data: biz } = await supabase
          .from("businesses")
          .select("id, owner_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (biz) {
          bizId = biz.id;
          userId = biz.owner_id;
        } else {
          const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
          if (customer.email) {
            const { data: authUser } = await supabase.auth.admin.getUserByEmail(customer.email);
            if (authUser?.user) {
              userId = authUser.user.id;
              const { data: foundBiz } = await supabase
                .from("businesses")
                .select("id")
                .eq("owner_id", userId)
                .maybeSingle();
              if (foundBiz) bizId = foundBiz.id;
            }
          }
        }

        if (bizId) {
          let plan: string | null = null;
          if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            plan = sub.metadata?.plan ?? null;
            await supabase.from("businesses").update({
              subscription_status: "active",
              ...(plan ? { subscription_plan: plan } : {}),
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
            }).eq("id", bizId);
          } else {
            await supabase.from("businesses").update({
              subscription_status: "active",
            }).eq("id", bizId);
          }
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Webhook handler error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
