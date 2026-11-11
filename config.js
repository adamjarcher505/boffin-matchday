// Online settings. Leave the Supabase values empty and the game runs fully offline on each device.
// Fill them in from Supabase → Project Settings → API (see SETUP.md). The "anon public" key is meant
// to be public; the database rules in supabase/schema.sql are what keep data safe.
window.BOFFIN_CONFIG = {
  supabaseUrl: "",        // e.g. "https://abcdefghijkl.supabase.co"
  supabaseKey: "",        // the long "anon public" key
  google: false,          // set to true once Google sign-in is switched on in Supabase
  shareUrl: ""            // the address people should open from shared results, e.g. "https://you.github.io/boffin-matchday/"
};
