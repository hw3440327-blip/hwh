# Cottage and seaside patch 4.3.1

Opening the decoration drawer used to measure its smaller viewport, resize the painting, and re-centre it. Selecting a surface also used `scrollIntoView`, which could scroll an enclosing scene. A 390×844 reproduction changed the painting from 1102 to 764 pixels wide and moved its scroll offset from 356 to 187 without a player camera action.

The painting now measures the unchanged scene container, skips redundant size updates, and centres before paint. Opening the drawer only crops the view; the phone drawer overlays the lower scene without reducing painting height. Surface selection scrolls only the scene viewport. No displacement or image-transform effect was added.

Inventory paintings remain intact. Six new resting poses use independently clipped atlas regions and item-specific aspect ratios: open book, flat shell, folded bread bag, flowers, lamp and cup. Window, desk and cabinet have different light and contact shadows. Old item IDs, unique ownership, placement values and plant age remain compatible. The desk baseline now meets its painted tabletop.

Sand writing uses locally bundled Ma Shan Zheng handwriting, individual letter angles, dark grooves and sunlit edges. The stone guide has a dark outline, bright dashed core, arrow, landing rings and a strength hint. Preview skip counts use the same force and stone rules as the throw. Pointer cancellation remains safe. The font licence is included in both archives.

## Verification

- 108 unit tests passed.
- 7 craft checks passed in the production website, self-contained offline HTML, and local desktop server. The new regression repeats opening, placing and selecting surfaces three times on both 1440×900 and 390×844 screens, checking scale, settled scrolling and source identity.
- All 15 bakery checks passed in each of those three distributions.
- All 19 memory-box checks passed on the website and offline HTML. All 15 town checks passed.
- Three Go tests, every one of the 276 embedded resource hashes, HTTP byte ranges, and a persistent-profile close/relaunch check passed. All Windows executable embedded bytes were checked; this Linux environment did not launch the native Windows GUI.
- Manual screenshots inspected both sets of three furnishings and the phone drawer. Additional sand and guide checks at 390×844 and 7680×4320 loaded the actual local handwriting font, found no horizontal overflow, and kept the 24-character writing inside the scene; the phone version uses a wider three-line region above the stone. Guide widths were 3 and 12 pixels respectively.
- Both release ZIPs passed complete CRC verification. The offline HTML makes no external resource requests. The desktop game uses only its loopback service.
- All 271 media files shared with 4.3.0 retain their hashes, including the original backgrounds and selected story narration. 8K backgrounds remain existing resampled outputs, not newly drawn native 8K art.

Machine-readable reports and the asset allowlist are published beside this note. Original screenshots and full local test logs stay in the ignored release directory. Older 4.0/4.1 downloadable ZIPs were removed from the current website to keep Pages below its storage limit; they remain in Git history. 4.2 and 4.3 downloads remain available.
