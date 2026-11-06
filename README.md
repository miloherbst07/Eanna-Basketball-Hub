# Éanna Hub

The club's own site for results, fixtures, teams and weekly top performers, for every Éanna Basketball team. It works on any phone, and people can add it to their home screen like an app.

**Stage 1 (this version)**
- Public pages: Home (top performers and this week's results), Results by week, all 44 Teams with records and league tables, and a Fixtures calendar with filters and "My competitions" switches.
- **Score-sheets:** coaches type in each player's points with the club code. A moderator checks the sheet, then approves it.
- **Underage rules:** set per age group (hidden, results only, first names, or full names). Players on 0 are never shown at underage, and any player can be hidden in Rosters.
- **Carousel maker:** builds the weekly "Top Performers" Instagram slides (1080 × 1350 PNG) in club branding.
- **Fixtures** come from the DMBB, DLBB and Basketball Ireland sites, refreshed by `tools/update_fixtures.py`.

Not in Stage 1: underage photos, reading score-sheets from photos, news, community, staff rooms, notifications and events. The designs for those are in `design/`.

## Cost
€0. It runs on Firebase's free Spark plan (Firestore and Google sign-in only, no Storage) and free static hosting (GitHub Pages or Netlify).

## Try it now (demo mode)
`js/config.js` has `firebase: null`, so the site runs in **demo mode**. Everything is saved in that browser only.
- Run `python3 -m http.server 8770` in this folder, then open http://localhost:8770
- Admin: More › Admin › Open admin (demo)
- Club code in demo: `EANNA26`

## Go live (about 20 minutes)
1. **Create the Firebase project.** Go to https://console.firebase.google.com, add a project called `eanna-club-hub`, and turn Google Analytics off. Ideally use a club Google account, so the club owns it.
2. **Add a web app.** Click ⚙ › Project settings › Your apps › Web (`</>`). Copy the `firebaseConfig` object into `js/config.js` as `firebase: { … }`.
3. **Turn on Google sign-in.** Build › Authentication › Get started › Sign-in method › Google › Enable.
4. **Create the database.** Build › Firestore Database › Create database. Choose **europe-west2 (London)** or **europe-west1 (Belgium)** and **production mode**.
5. **Add the rules.** Firestore › Rules: paste in all of `firestore.rules`, then Publish.
6. **Add yourself as a moderator.** Firestore › Data:
   - Start a collection called `admins`, with Document ID = your Google email (e.g. `you@gmail.com`) and the field `role: "owner"`. Do the same for your backup admin. After that, add and remove moderators in the site itself (Admin › Moderators) and choose what each one can do.
   - Add a document `private/club` with a field `code: "YOURCODE"`. This is the club code coaches type.
7. **Publish the site.** Drag this folder onto Netlify (like the Milo Motion Images site), or push it to a GitHub repo with Pages turned on.
8. **Allow the site address.** Authentication › Settings › Authorised domains: add the site's address (e.g. `eanna-hub.netlify.app`).

To add more moderators, add another document to `admins` with their Google email as the ID.

## Refreshing fixtures and results
```
python3 tools/update_fixtures.py
```
It reads the public fixtures pages only, one page a second, which takes about 2–3 minutes. Then it writes `data/eanna-fixtures.json`. Re-publish the site afterwards. It won't save anything if it finds fewer than 100 games, which would mean a site changed layout.

Tell DMBB, DLBB and Basketball Ireland that the hub does this weekly.

## Files
| Path | What it is |
|---|---|
| `index.html` | The app shell |
| `css/hub.css` | Club styling (colours from the brand kit) |
| `js/config.js` | Firebase settings, demo club code |
| `js/store.js` | Data layer: demo (browser) or Firebase |
| `js/app.js` | All pages, score-sheets, admin, carousel |
| `data/eanna-fixtures.json` | Fixtures, results, teams, tables |
| `firestore.rules` | Who can read and write what |
| `tools/update_fixtures.py` | Fixtures refresher |
| `design/` | Walkthrough screens and the proposal for later stages |

## Privacy
- No dates of birth, addresses or phone numbers are collected.
- Rosters, the club code and score-sheet photos are moderator-only.
- Public box scores are built at approval time with the underage rules already applied, so hidden names never reach the public side.
