---

title: "Submit Required Forms"
layout: page.njk
section: resources
description: "Upload Concussion, Sudden Cardiac Arrest, and other required AYSO Region 13 forms via the secure Google form upload portal."
---

If you printed and signed the required forms, use the button below to upload them.

The forms supported here are:

- Concussion Information Sheet
- Sudden Cardiac Arrest (SCA) Information Sheet
- AYSO Kids Zone (legacy family pledge submissions)

## Upload

<p><a href="?go=1"><button class="btn btn-primary">Open the upload form</button></a></p>

<p><span id="loadstatus"></span></p>

<iframe id="ifr" style="position: fixed; top: 0; left: 0; bottom: 0; right: 0; width: 100%; height: 100%; border: none; margin: 0; padding: 0; overflow: hidden; z-index: 999999; display: none; background: white;"></iframe>

<script>
function showApp() {
  document.getElementById('loadstatus').textContent = 'Loading … please wait';
  var ifr = document.getElementById('ifr');
  ifr.style.display = '';
  ifr.src = "https://script.google.com/macros/s/AKfycbw6MNfegAGqUpELmvz5jKHtcaX0GM55mw0xO3waO17p1n6uEcU44OfJ0x72MgeuklNs/exec" + window.location.search;
}
if (window.location.search.indexOf('go=1') !== -1) showApp();
if (window.location.search.indexOf('go=2') !== -1) showApp();
if (window.location.search.indexOf('key=') !== -1) showApp();
if (window.location.search.indexOf('ID=') !== -1) showApp();
</script>

## If You Have Trouble

- **Players in 4U and 5U:** bring the paper forms with you on the first day. There will be a box at the field to drop them in.
- **Everyone else:** bring the forms to your coach or team manager, who can scan and upload them for you.

## Print the Forms

If you still need the printable versions:

- [Concussion & SCA Forms (PDF)](/assets/docs/concussion-sca-forms.pdf)
- [Kids Zone (no signature required — community standards)](/families/pledge/)

## Related Pages

- [Registration Forms](/register/forms/) — All required forms at registration
- [Document Library](/resources/documents/) — All Region 13 documents

*Last updated: [DATE]*
