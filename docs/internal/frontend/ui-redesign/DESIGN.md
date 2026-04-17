# Design System Specification: Kinetic Play
 
## 1. Overview & Creative North Star
**Creative North Star: "The Kinetic Playground"**
 
This design system moves away from the static, rigid nature of traditional educational tools. Instead, it embraces "Kinetic Play"—a philosophy where the UI feels like a living, breathing game board. We achieve a high-end editorial feel by combining high-energy saturation with sophisticated "Glassmorphism" and intentional asymmetry.
 
While the core audience includes children, the execution must remain "polished-premium." We avoid "childish" cliches (like jagged crayons or messy splatters) in favor of precision-engineered geometry, generous whitespace, and a layered depth that feels like a physical, high-end tabletop game. Floating letter elements are not just decorations; they are environmental pieces that interact with the UI through depth and blur.
 
---
 
## 2. Colors & Visual Soul
The palette is a high-octane mix of urgent reds and organic greens, stabilized by a sophisticated grayscale.
 
### The "No-Line" Rule
**Strict Mandate:** Traditional 1px solid borders are prohibited for sectioning or containment.
Structure must be defined through:
- **Tonal Shifts:** Placing a `surface_container_high` card on a `surface` background.
- **Soft Shadows:** Using ambient, tinted depth rather than a stroke.
- **Negative Space:** Allowing the layout to breathe to define boundaries.
 
### Color Tokens
* **Primary (`#bb000f` / `#e51c1e`):** The "Dash." Used for primary actions and energetic focal points.
* **Secondary (`#406926` / `#c0f19d`):** The "Win." Used for success states, progress tracking, and leveling up.
* **Tertiary (`#755700` / `#fabd00`):** The "Reward." Used for coins, streaks, and special letter tiles.
 
### Signature Textures & Glassmorphism
To elevate the experience, use **Glassmorphism** for all floating letter elements and modal overlays. Use a combination of `surface_container_lowest` at 60% opacity with a `backdrop-blur` of 20px.
* **The Gradient Rule:** Main CTAs should not be flat. Use a subtle linear gradient from `primary` to `primary_container` (top-to-bottom) to give buttons a "clickable" 3D volume.
 
---
 
## 3. Typography
We utilize a "Heavy-Rounded" hierarchy to maintain friendliness without sacrificing readability.
 
* **Display & Headlines (Plus Jakarta Sans):** These are our "Hero" fonts. They should be used with tight letter-spacing (-2%) to feel impactful. Use `display-lg` for game-over scores and `headline-lg` for category titles.
* **Body & Labels (Be Vietnam Pro):** A highly legible sans-serif that provides a professional counter-weight to the playful headlines.
* **Intentional Scale:** Use extreme scale contrast. Pair a massive `display-lg` letter tile with a tiny, uppercase `label-md` for metadata. This "Big-and-Small" approach is a hallmark of high-end editorial design.
 
---
 
## 4. Elevation & Depth
Depth is not a decorative choice; it is a functional tool to convey hierarchy.
 
### The Layering Principle
Think of the UI as three physical layers:
1. **The Base (Surface):** The neutral ground.
2. **The Board (Surface Container Tiers):** Use `surface_container_low` for the main play area and `surface_container_highest` for active cards.
3. **The Kinetic Layer (Floating Elements):** Individual letters and icons that sit above everything with `ambient shadows`.
 
### Ambient Shadows & Ghost Borders
* **Ambient Shadows:** Use a blur radius of 30px-60px. The shadow color must be a 6% opacity tint of `primary` or `secondary` depending on the element, creating a soft "glow" rather than a grey smudge.
* **The Ghost Border:** For accessibility in input fields, use a 1.5px border of `outline_variant` at 20% opacity. It should feel like a suggestion of a shape, not a hard cage.
 
---
 
## 5. Component Guidelines
 
### Buttons (The Kinetic Triggers)
* **Primary:** Heavy rounded (`full`), using the `primary` gradient. On hover, the button should "lift" via an increased ambient shadow, not a color change.
* **Tertiary:** No background. Use `title-sm` typography in `primary` color with a subtle `surface_container` hover state.
 
### Letter Cards
* **Execution:** Forbid dividers. Use `surface_container_highest` for the card body.
* **Interaction:** When a card is selected, transition the background to `secondary_container` and apply a 4px "Ghost Border" of `secondary`.
 
### Input Fields (Word Entry)
* **Style:** Minimalist. No bottom line. Use a `surface_container_low` pill shape. The text should be centered `headline-md` to make the user feel their input is significant.
 
### Kinetic Letter Elements (Floating)
* **Style:** Randomly rotated (between -15deg and 15deg). Use `surface_container_lowest` with 40% opacity and `backdrop-blur`. These elements should appear *behind* the main text content but *above* the background.
 
---
 
## 6. Do’s and Don’ts
 
### Do
* **Do** use asymmetrical layouts. A card grid doesn't have to be perfectly centered; staggering cards by 8-16px creates energy.
* **Do** use "Full" roundness for buttons and "XL" (3rem) for cards to maintain the friendly, "bouncy" brand voice.
* **Do** overlap elements. Let a floating 'A' or 'Z' slightly tuck behind a UI container to create 3D space.
 
### Don't
* **Don't** use black (#000000) for text. Use `on_surface` (#1b1b1b) to keep the contrast high but the feel "premium."
* **Don't** use 1px dividers. If you need to separate content, use a 24px-32px vertical gap or a subtle shift from `surface` to `surface_container_low`.
* **Don't** use standard drop shadows. If it looks like a default Photoshop shadow, it's wrong. Keep blurs large and opacities under 8%.