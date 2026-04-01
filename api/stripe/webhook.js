const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const SB_URL = 'https://rhsszirtbyvalugmbecm.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

function getRawBody(req) {
  return new Promise(function(resolve, reject) {
    var chunks = [];
    req.on('data', function(chunk) { chunks.push(chunk); });
    req.on('end', function() { resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

async function updatePlayer(email, tier) {
  var res = await fetch(
    SB_URL + '/rest/v1/players?nil_contact_email=eq.' + encodeURIComponent(email),
    {
      method: 'PATCH',
      headers: {
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + SB_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ profile_tier: tier })
    }
  );
  console.log('Update player', email, 'to', tier, '- status:', res.status);
  return res.ok;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var sig = req.headers['stripe-signature'];
  var event;

  try {
    var rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  if (event.type === 'checkout.session.completed') {
    var session = event.data.object;
    var email = (session.customer_details && session.customer_details.email) || session.customer_email;
    if (email) {
      console.log('Checkout completed:', email);
      await updatePlayer(email, 'premium');
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    var sub = event.data.object;
    try {
      var customer = await stripe.customers.retrieve(sub.customer);
      if (customer.email) {
        console.log('Subscription cancelled:', customer.email);
        await updatePlayer(customer.email, 'free');
      }
    } catch (err) {
      console.error('Downgrade error:', err.message);
    }
  }

  res.status(200).json({ received: true });
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
