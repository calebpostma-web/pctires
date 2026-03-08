/**
 * Cloudflare Pages Function: /functions/send-order-email.js
 * Sends order confirmation emails
 * Replaces the old Netlify function
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: CORS_HEADERS,
    });
  }

  try {
    const body = await request.json();

    const {
      customerName, customerEmail, customerPhone,
      items, subtotal, tax, total,
      installDate, installTime, deliveryType,
      address,
    } = body;

    // Format order items
    const itemsList = (items || []).map(i =>
      `  - ${i.qty}x ${i.brand} ${i.name} (${i.size}) — $${(i.price * i.qty).toFixed(2)}`
    ).join('\n');

    // Email to business owner
    const ownerEmail = `
New Order Received — PC Tires

Customer: ${customerName}
Email: ${customerEmail}
Phone: ${customerPhone}

ITEMS:
${itemsList}

Subtotal: $${subtotal}
Tax (HST): $${tax}
Total: $${total}

Delivery: ${deliveryType === 'shop' ? 'Ship to PC Tires (for installation)' : `Ship to: ${address}`}

${installDate ? `Installation: ${installDate} at ${installTime}` : 'No installation booked — customer arranging separately'}

---
Sent automatically by pctires.ca
    `.trim();

    // Use Cloudflare Email Workers or just log for now
    // TODO: Add your email provider (Resend, SendGrid, Mailgun, etc.)
    // For now, log the order details
    console.log('New order:', ownerEmail);

    // Return success — the frontend will show confirmation
    return new Response(JSON.stringify({
      success: true,
      message: 'Order received',
      orderId: `PCT-${Date.now()}`,
    }), {
      status: 200,
      headers: CORS_HEADERS,
    });

  } catch (err) {
    console.error('Email function error:', err);
    return new Response(JSON.stringify({ error: 'Failed to process order', message: err.message }), {
      status: 500,
      headers: CORS_HEADERS,
    });
  }
}
