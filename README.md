# Common Ground

A live, facilitator-led Keynesian beauty contest for classrooms and workshops. Participants join with a QR code, choose a number each round, and then see the group average, the winning target, the closest player, and the full choice distribution.

The site is plain HTML, CSS and JavaScript, so the frontend can be hosted free on either Vercel or GitHub Pages. Supabase's free plan provides the database and realtime updates between devices.

## Try it locally

No build step is needed. From this directory run:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. Until Supabase is configured, the app uses local browser storage and labels itself **Demo mode**. Same-browser tabs can still play together. The **View demo** button opens populated results immediately.

## Enable real cross-device play (free)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in [`supabase.sql`](./supabase.sql), and run it once.
3. Open **Project Settings → API** and copy the project URL and anon/public key.
4. Paste both values into [`config.js`](./config.js):

```js
window.COMMON_GROUND_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_ANON_KEY"
};
```

The anon key is designed to be public. Keep Row Level Security enabled and never put a Supabase service-role key in this file.

Facilitator updates use a random private token and the token is checked inside a database function. Participants never receive it.

## Free deployment

### Vercel (easiest)

1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Set **Framework Preset** to `Other`, leave **Build Command** empty, and set **Output Directory** to `.`.
4. Deploy. Open the deployed URL, create a room, and scan its QR code from a second device.

Every push to the default branch triggers a new deployment.

### GitHub Pages

1. Push the files to a GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)`, then save.
5. The site will appear at `https://YOUR-NAME.github.io/REPOSITORY/`.

Relative asset paths are already used, so project Pages URLs work without changing the code.

## Workshop flow

- The facilitator sets 3–10 rounds, a number range, target multiplier and optional timer.
- The waiting room displays both a QR code and six-character join code.
- Participants need only a display name—no accounts.
- The facilitator starts and reveals each round manually.
- Results show the average, target, response count, spread, closest player, every anonymous choice, a histogram, and the average/target trend across rounds.

## Production security note

This is a workshop-ready prototype built around anonymous access. The included `host_update_room` database function checks the facilitator token server-side. For a large public event, the stronger setup is to also move room creation and response submission into Supabase Edge Functions, validate participant tokens server-side, add CAPTCHA/rate limits, and hide responses until a round is revealed. Local demo mode is unaffected.

Rooms are not automatically removed. A scheduled Supabase job can delete rooms older than a day:

```sql
delete from public.rooms where created_at < now() - interval '24 hours';
```
