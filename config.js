// Online settings. Leave the Supabase values empty and the game runs fully offline on each device.
// Fill them in from Supabase → Project Settings → API (see SETUP.md). The "anon public" key is meant
// to be public; the database rules in supabase/schema.sql are what keep data safe.
window.BOFFIN_CONFIG = {
  supabaseUrl: "https://pytykhrhhfzwzyndiqjz.supabase.co",        // e.g. "https://abcdefghijkl.supabase.co"
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5dHlraHJoaGZ6d3p5bmRpcWp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1MDM4ODQsImV4cCI6MjExMDA3OTg4NH0.ga6_jgIWRn7FCdGKfwH27SFh1lP34jlRphL0azyTq1k",        // the long "anon public" key
  useDb: true,            // the 1X2 football database (data/x/). The one-line rollback: set this to false and every mode runs on the old question bank again
  google: false,          // set to true once Google sign-in is switched on in Supabase
  shareUrl: "https://adamjarcher505.github.io/boffin-matchday/"            // the address people should open from shared results, e.g. "https://you.github.io/boffin-matchday/"
};
