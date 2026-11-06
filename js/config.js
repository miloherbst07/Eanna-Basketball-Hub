// Éanna Hub settings.
//
// FIREBASE: leave `firebase` as null to run in DEMO MODE (everything is saved in
// this browser only, nothing is shared). To go live, create a free Firebase
// project, add a Web app, and paste its config object here. See README.md.
window.HUB_CONFIG = {
  // Set to null to go back to demo mode.
  firebase: {
    apiKey: "AIzaSyBXiEQQ9zO2iI1ZckNvKoB3_Svx3NG2ifs",
    authDomain: "eanna-basketball-hub.firebaseapp.com",
    projectId: "eanna-basketball-hub",
    storageBucket: "eanna-basketball-hub.firebasestorage.app",
    messagingSenderId: "522029497668",
    appId: "1:522029497668:web:bc932242d12b6e4da06b11"
  },

  // Demo mode only: the club code coaches type to send a score-sheet.
  // In live mode the code is stored privately in Firebase (Admin › Settings).
  demoClubCode: "EANNA26",

  clubName: "Éanna Basketball",
  season: "2026/27"
};
