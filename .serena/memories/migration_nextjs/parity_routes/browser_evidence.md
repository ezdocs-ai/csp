# Browser parity evidence (Wave 0 discovery)

Captured 2026-07-28, viewport 1440x1000. Angular (localhost:4200) tab 0, Next (localhost:3000) tab 1.
**BLOCKER**: Next session cookie expired mid-run → every `localhost:3000/*` redirects to `/login`. Only Next Video was captured before expiry. All other Next routes UNVERIFIED. Did NOT re-login (Google SSO needs user; out of scope).
Angular screenshots saved as `.png` for home, `.jpeg` for heavy pages (png screenshot timed out on `/video` and beyond — Angular hydration warning in console, unrelated to parity).

## Routes with VALID paired evidence
- **Video** (`/video` vs `/video?workspaceId=1`) — both captured default; Next workspace-select-open captured.

## Routes ANGULAR-ONLY (Next unverifiable due to auth blocker)
Home `/`, Audio `/audio`, VTO `/vto`, Imagen Upscale `/imagen-upscale`, Fun Templates `/fun-templates`, Gallery `/gallery` (+ filters open).
Next `/`, `/audio`, `/vto`, `/imagen-upscale`, `/gallery`, `/fun-templates`, `/workflows`, `/workbench`, `/admin` — NOT captured (session dead).

## Artifacts
Angular: parity-home-angular-default.png, -default-fullpage.png, -tooltip-style.png, -workspace-menu-open.png, -profile-nav-menu-open.png, -tools-submenu-open.png, -style-popover-open.png; parity-video-angular-default.jpeg, -mode-menu-open.jpeg; parity-audio-angular-default.jpeg; parity-vto-angular-default.jpeg; parity-imagen-upscale-angular-default.jpeg; parity-fun-templates-angular-default.jpeg; parity-gallery-angular-default.jpeg, -filters-expanded.jpeg.
Next: parity-video-next-default.jpeg, -workspace-select-open.jpeg.

---

## Shell / chrome (HIGH confidence — captured both)
Angular: NO persistent sidebar. Header row = [workspace switcher pill: icon + "Trd Csp Workspace" + unfold_more] ... [profile avatar img]. Profile avatar click opens horizontal nav menu containing: Images | Video | Audio | Tools(handyman, hover→flyout: Virtual Try-On, Fun Templates, Workflows, Imagen Upscale) | Arena(bookmark_heart, tooltip "Media Gallery") | workbench(construction) | Admin | Logout. Banner tooltip on profile open: "Hey there Avei! Click to make the menu dynamic".
Next: PERSISTENT left `<aside>` sidebar with avatar block (avei@tridorian.com, no menu on click — static), then links Image/Video/Audio/"Tools"(plain text, no flyout)/Gallery/Workbench/Logout. Top `<banner>` has "Active workspace" `<select>` + email. Hamburger button title="Open navigation" exists (mobile toggle). NO workspace menu, NO profile menu.

| # | Mismatch | Class | Severity | Confidence |
|---|---|---|---|---|
| S1 | Shell topology: Angular = header + profile-dropdown nav (no sidebar); Next = persistent left sidebar + topbar. Fundamentally different IA. | layout mismatch | blocker | high |
| S2 | Workspace switcher: Angular = rich menu (active workspace w/ check, Create New Private Workspace, Invite Users [disabled on public w/ tooltip "You can invite users in your Private Workspaces!"], Brand Guidelines, Feedback, + banner "You are on a public workspace. Click to switch workspaces!"). Next = plain `<select>` with only workspace name options + disabled "Select workspace" placeholder. Missing: Create, Invite, Brand Guidelines, Feedback, public-workspace banner. | missing | blocker | high |
| S3 | Profile control: Angular = avatar opens full nav dropdown; Next = static avatar, no menu. | missing | high | high |
| S4 | Tools group: Angular groups 4 tools under Tools flyout; Next shows bare "Tools" text with no children (submenu items not reachable). VTO/Workflows/Imagen Upscale appear unreachable in Next sidebar. | missing | high | high |
| S5 | Arena vs Gallery: Angular nav label = "Arena" (tooltip "Media Gallery"); Next link = "Gallery". Label mismatch. | behavior mismatch | low | high |
| S6 | workbench casing: Angular "workbench" (lowercase); Next "Workbench". | behavior mismatch | low | high |
| S7 | Next header shows "avei@tridorian.com" as static text; Angular shows it only inside profile tooltip. Email exposure location differs. | layout mismatch | low | high |

## Home / Image generation (Angular captured; Next NOT — auth blocker)
Angular `/`: hero h1 "Welcome to Creative Studio". Below: horizontal OPTION TOOLBAR of 9 icon+label chips, each matTooltip "Select <X>" / "Enable <X>" / "Enhance Prompt with AI": Style(style, default "Photorealistic"), Color & Tone(palette), Lighting, Composition(movie_edit), Negative Phrases (N), Watermark(branding_watermark, "No"), Google Search(switch), Brand Guidelines(switch), Enhance Prompt(switch). Below: composer row = [mode dropdown "Text to Image" w/ expand_more] + [model chip "Nano Banana 2"] + [aspect "1:1"] + [count "x1"] + [resolution 4k icon button] ; large prompt textarea (placeholder "Generate an image with text..."); footer row = Rewrite(drive_file_rename_outline) + Generate. NO separate page heading above form, NO result panel visible in default state.
Style popover opened: 8 menuitems (Cinematic[active], Fantasy, Modern, Monochrome, Photorealistic, Realistic, Sketch, Vintage).

| # | Mismatch | Class | Severity | Confidence |
|---|---|---|---|---|
| H1 | Next home `/` not captured — comparison impossible this run. Prior memory notes Next uses generic page heading + permanent form. | route/access mismatch | blocker | high (re-verify) |
| H2 | Angular option toolbar is a contextual chip bar w/ matTooltips; Next (per prior evidence) renders controls as labelled static form. | layout mismatch | high | medium (Next unverified live) |

## Video (VALID pair)
Angular `/video`: title text "Generate Video Ads" (no h1). Option toolbar (video variant): Style, Color & Tone, Lighting, Composition, **Audio On**(volume_up), Negative Phrases (N), Brand Guidelines(switch), Enhance Prompt(switch). [NO Google Search, NO Watermark — video-specific]. Composer: [mode "Ingredients to Video"] + [model "gemini-omni-flash-preview" w/ auto_awesome] + [aspect **9:16**] + [count "x1"] + [duration **8s**] + [resolution **1k**]; prompt textarea; reference strip = [+ 0/3 images][Video Ref(videocam)][Audio Ref(audiotrack)]; footer Rewrite + Generate.
Mode dropdown (5 modes): Text to Video(description), Frames to Video(image), **Ingredients to Video**(layers, active), Extend Video(extension), Concatenate Video(merge).
Next `/video?workspaceId=1`: h1 "Video studio". Vertical LABELLED form: Model(`<select>` 16 opts, default "Dreamina Seedance 2.0"), Mode(`<select>` 4 opts: Text to video, First frame, Last frame, Reference images — default Text to video), Prompt textarea, Negative prompt textarea, then grid Resolution/Aspect/Duration/Count (`<select>`s: Res 1K/2K/4K default 1K; Aspect 16:9 default; Duration 5 seconds/10 seconds default 5s; Count 1), Include audio(checkbox unchecked), Generate[disabled]. Right column: "Result" h2 + "No generation yet."

| # | Mismatch | Class | Severity | Confidence |
|---|---|---|---|---|
| V1 | Page composition: Angular = title + contextual option chips + single composer; Next = h1 + vertical labelled form + separate "Result" panel. | layout mismatch | blocker | high |
| V2 | Default model: Angular = gemini-omni-flash-preview; Next = Dreamina Seedance 2.0. | state mismatch | high | high |
| V3 | Default mode: Angular = "Ingredients to Video"; Next = "Text to video". | state mismatch | high | high |
| V4 | Default aspect: Angular = 9:16; Next = 16:9. | state mismatch | high | high |
| V5 | Default duration: Angular = 8s; Next = 5 seconds (and Next options are 5/10s only — Angular offered 8s). Option set differs. | state mismatch | high | high |
| V6 | Mode set: Angular 5 (Text/Frames/Ingredients/Extend/Concatenate); Next 4 (Text/First frame/Last frame/Reference images). Missing Extend & Concatenate; modes not 1:1 (Frames vs First/Last frame). | missing | blocker | high |
| V7 | Audio control: Angular = option-bar chip "Audio On"(default ON, stateful toggle in toolbar); Next = checkbox "Include audio"(default UNCHECKED). Default + control type differ. | behavior mismatch | high | high |
| V8 | Reference media: Angular = inline strip w/ image(0/3)/Video Ref/Audio Ref chips; Next = NO reference UI in Text-to-video mode (verify other modes post-auth). | missing | high | high |
| V9 | Option toolbar (Style/Color/Lighting/Composition/Neg/Brand/Enhance): present Angular, ABSENT Next. | missing | blocker | high |
| V10 | Tooltips: Angular matTooltips on every option/control; Next has NO tooltips on generation controls (only nav `title="Open navigation"`). | missing | high | high |
| V11 | Resolution options: Angular default 1k; Next default 1K (case). Minor. | behavior mismatch | low | high |

## Audio `/audio` (Angular only)
h1 "Describe Your Sound". Left = `<video>` placeholder ("Your browser does not support HTML5 video"). Right form: radiogroup "Select Model" = Lyria (Music)[checked] / Chirp TTS / Gemini TTS; separator; Prompt(placeholder "Describe the music..."); Negative Prompt("What to avoid"); Seed(spinbutton); Results(mat-select, default 4); Create button. NO option toolbar. Next `/audio` NOT captured.

## VTO `/vto` (Angular only)
h1 "Creative Studio Virtual Try-On" + subtitle "A showcase of Virtual Try-On for your clothes and more ✨". Stepper tabs: 1 "Choose your model"[selected] / 2 "Choose your clothes"[disabled]. Step 1: radiogroup Female[checked]/Male; "Select a model" grid of female thumbnails + Next; "Or upload your own" dropzone + Examples(4 thumbs). Next `/vto` NOT captured.

## Imagen Upscale `/imagen-upscale` (Angular only)
h1 "Creative Studio Imagen Upscale". Two-column: (1) Upload Image to Upscale — dropzone; (2) Upscaled Result — "Comparison results will appear here." Controls: Upscale Factor 2x/3x/4x; Enhance Input Image checkbox "Enable Enhancement"; Image Preservation Factor slider(0.5) + Auto; Upscale[disabled]. Next `/imagen-upscale` NOT captured.

## Fun Templates `/fun-templates` (Angular only)
h1 "Creative Studio Fun Templates" + subtitle. Filter bar: Industry(combobox), Media Type(combobox), Search by Name(textbox "e.g., Rolex"), Clear Filters. Grid of 18 template cards: thumbnail + ref-asset icons + h3 name + brand(Cymbal) + industry + mime + description + tags + "Use Template". Next `/fun-templates` NOT captured.

## Gallery `/gallery` (Angular only)
h1 "Creative Studio Media Gallery" + subtitle. Toolbar: search("Search prompt, model or email..."), date range(Start–End + calendar), Filters toggle(expand_less when open), Select All. Filters expanded row: All Types / All Models / All Assets / Tags + Manage Tags(settings); checkbox "Select only my media". Grid grouped by date headings "Today"/"Yesterday", mix of `/gallery/:id` (generated) and `/asset-detail/:id` (uploads, cloud_upload badge) cards; multi-thumbnail items have nav arrows. "Load more" button. Next `/gallery` NOT captured.

## Tooltip inventory (Angular, per route)
- Generation option chips: "Select Style", "Select Color & Tone", "Select Lighting", "Select Composition", "Select Negative Phrases", "Select Watermark", "Enable Google Search", "Enable Brand Guidelines", "Enhance Prompt with AI".
- Nav: "Images", "Video", "Audio", "Media Gallery"(on Arena), "Workbench", "Admin", "Logout".
- Workspace menu public banner: "You are on a public workspace. Click to switch workspaces!"; Invite(disabled) tooltip: "You can invite users in your Private Workspaces!".
- Next tooltips observed: ONLY `title="Open navigation"` on hamburger. No `matTooltip`/`title`/`aria-label` on any generation, workspace, or profile control.

## NOT verified this run
- Next routes: `/`, `/audio`, `/vto`, `/imagen-upscale`, `/gallery`, `/fun-templates`, `/workflows`, `/workbench`, `/admin`, `/gallery/:id` (all redirect to `/login`).
- Angular routes not reached: `/workflows`(+new/edit/executions), `/workbench`, `/admin/*`, `/gallery/:id`, `/asset-detail/:id`, `/login`.
- Mobile (390x844) captures: NONE (paused before reaching mobile step).
- Option popover contents on Angular (only Style opened): Color/Lighting/Composition/Negative/Watermark/Brand-Guidelines popover lists not captured.
- Empty/loading/error/success generation states: none triggered (no job submission allowed).
- Angular workspace "Create New Private Workspace" / "Brand Guidelines" / "Feedback" dialogs: NOT opened (would mutate state or need brand upload).
- Model selector contents on Angular Image/Video (chip click → menu) not captured; only the displayed default.
- Concatenate/Extend video mode UIs not entered (would change composer).
- Profile menu "dynamic" behavior beyond first open not explored.

## Confidence
Shell + Video comparisons: HIGH (both apps live-captured). All Angular-only route facts: HIGH for Angular behavior, NOT comparable to Next. Re-running after Next re-login required to validate H2, and all Audio/VTO/Upscale/Templates/Gallery/Workflows/Workbench/Admin pairs.
