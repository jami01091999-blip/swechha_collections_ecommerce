# Go-live checklist (Phase 8)

Everything below is configuration; no code changes are needed to go from test mode to live.

## Before you start

- [ ] Confirm GST registration, invoice format and GST on delivery/COD fees with your CA.
- [ ] Review the policy pages (`/policies/...`) — they are filled from Admin → More → Shop rules and Lookbook details.
- [ ] Rotate every secret that was ever pasted into a chat (MongoDB password, Cloudinary secret, Razorpay keys).

## Accounts

- [ ] Domain bought and connected to Vercel (Project → Settings → Domains).
- [ ] Razorpay: complete KYC; the live site must show the policy pages and a contact page.
- [ ] Shiprocket (optional): account, pickup address, KYC, API user (Settings → API).
- [ ] Email from your domain (Resend/Brevo/SES) or keep the Gmail App Password for low volume.

## Render (API) environment

- [ ] `APP_MODE=live` (the API refuses to start without the live-mode variables below)
- [ ] `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (live keys), `RAZORPAY_WEBHOOK_SECRET`
- [ ] Razorpay → Webhooks (live mode): `https://<render-service>.onrender.com/api/webhooks/razorpay`,
      events `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`
- [ ] `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
- [ ] `CLIENT_ORIGIN` and `SITE_URL` = your domain (e.g. `https://swechha.in`)
- [ ] `CRON_SECRET` (also as a GitHub repository secret for the keep-alive workflow)
- [ ] Shiprocket only: `SHIPPING_PROVIDER=shiprocket`, `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`,
      `SHIPROCKET_PICKUP_LOCATION`, `SHIPROCKET_WEBHOOK_TOKEN`; webhook URL `https://<render-service>.onrender.com/api/webhooks/courier`
- [ ] Paid Render instance (the free one sleeps) and Vercel Pro (Hobby is for non-commercial use)

## Vercel (site) environment

- [ ] `VITE_APP_MODE=live` (removes the "Test shop" strip), then redeploy

## Database

- [ ] `npm run db:indexes` in `server/` against Atlas (creates every index, including unique emails/orders and auto-expiry)
- [ ] Atlas backups on (paid tiers) or a scheduled export

## Shop rules (Admin → More → Shop rules)

- [ ] Delivery charge, free-delivery threshold, delivery days, pickup PIN code
- [ ] COD on/off, fee, maximum order value, blocked PIN code prefixes
- [ ] Return window, time to pay
- [ ] Business name, GSTIN, state, address (printed on invoices)

## Final test on the live site

- [ ] Place a real low-value online order, then cancel it and confirm the refund arrives.
- [ ] Place a COD order, ship it from the admin, mark delivered, request a return.
- [ ] Check the confirmation, shipped and refund emails arrive (and not in spam).
