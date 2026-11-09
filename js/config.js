/* Paste the Apps Script web app URL here after deploying (see README, step 3).

   This must be the url of the deployment that is actually serving. Editing an
   existing deployment (the pencil in Manage deployments) keeps its url and this
   file does not change; creating a NEW deployment mints a new url and leaves
   the old one running the old code, which fails silently - the site keeps
   talking to the version it has always talked to and nothing reports a problem.
   Updated 9 November 2026 for the deployment that carries Pdf.gs and Mail.gs.
   Leave API_URL empty to run with the files in data/ only (no quotation numbers are issued).
   - network.json: schedule, distances, routes, services, vessels (lives in this repository)
   - tariffs.json: offline copy of the tariffs; the live tariffs come from the Google Sheet */
window.SDG_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbxiYVcF2Utj0a1mk8YxU3ISUkajbZzDa_fEvS4hhXQbeB_7vYTu9Oj1IWRHZJmOJReT/exec",
  NETWORK_URL: "data/network.json",
  TARIFFS_URL: "data/tariffs.json"
};
