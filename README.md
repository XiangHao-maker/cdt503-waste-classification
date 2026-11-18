# XIANG Hao · CDT503 Waste Classification

**Live demo:** https://xianghao-maker.github.io/cdt503-waste-classification/

Upload a photo or take a snapshot with a device camera. Classify a single item into six TrashNet material categories: cardboard, glass, metal, paper, plastic, and trash.

The browser runs the bundled ONNX model locally. Images are not uploaded to an inference server. On a phone, choose a photo from the gallery; on supported devices the camera tab can also capture a snapshot after permission is granted. Use a current Chrome, Edge, or Safari browser and wait for model loading to finish.

## Model and evaluation

- Frozen ImageNet MobileNetV3-Large V2 feature extractor and class-balanced multinomial logistic regression head; not end-to-end fine-tuning.
- Author-sourced TrashNet, 2,527 original images; three exact pixel duplicates removed. Fixed seed 503, stratified train/validation/test split 1,766/379/379.
- Validation selects training augmentation and regularization, and fits temperature scaling. Held-out test accuracy **89.18%**, macro F1 **0.8724**.
- Camera/mobile real-world accuracy has not been independently measured. Six material labels are not equivalent to a city's waste-bin categories; no food, battery, or hazardous-waste recognition support. Multi-item extraction uses foreground segmentation and connected components, not a trained waste instance detector; touching objects can merge and background objects can be selected.
- Full metrics and source provenance are in `reports/`; failed test examples are displayed in the application. Source and third-party notices are in `THIRD_PARTY_NOTICES.md`, `licenses/`, and `vendor/LICENSE`.

## Hosting

Buildless static HTML/CSS/JS, ONNX Runtime Web 1.22.0. GitHub Pages publishes the root of the `main` branch. All assets use relative paths and are served over HTTPS. Camera access requires user permission and supported hardware. HTTPS deployment does not itself verify physical camera performance.

This repository contains the deployable website. Training code, raw data, course materials, and local QA records remain in the owner's separate local final project2 folder.

## Live camera and RE:CATCH (2026-11-18)

Physics update: locally bundled Matter.js 0.20.0 simulates the cutouts with gravity, friction, rebound, rotation, sleeping bodies, and fixed 60 Hz integration. Collision hulls approximate the opaque cutout silhouette with convex polygons; concave holes are not modeled. Drag the machine handle or canvas, or use **Shake machine**. Grabbing temporarily makes a body kinematic/non-colliding; the body is removed as it passes through the sorting outlet. Restart and Clear reset the physics world.

Three inputs are available: drag the machine handle/canvas, move the actual browser window (enabled by default), or opt into device-motion sensing. Mouse/touch and the Shake machine button remain available without sensor permission. No native helper or driver is installed.

Window tracking samples screenX/screenY every 50 ms and applies opposite acceleration and a braking impulse. It ignores maximize/restore/resize, large monitor/snap jumps and inactive/hidden game intervals. Use an unmaximized standalone browser window; embedded panels or privacy restrictions may expose fixed coordinates. A position change must actually be observed before the status says movement was detected. Native window dragging was not available in the automation surface; the coordinate-to-physics integration was tested with simulated browser coordinates.

Device motion is opt-in via Enable device motion. It requires a secure context and compatible hardware/browser, with user permission where required. Only valid numeric accelerometer data marks the sensor connected. Gravity-inclusive values use a baseline; forces are corrected for screen orientation. No data within six seconds disables the listener and shows a fallback message. Permission denial, unsupported devices, repeated clicks and stale permission callbacks are handled without disabling other inputs. Real hardware accelerometer output has not been verified.

`play.js` is the editable arcade source. HTML loads an immutable `arcade-<sha256 prefix>.js` copy to prevent an older cached script from being mixed with new UI. After editing the source, run `node ../scripts/prepare_arcade_assets.cjs` from this directory and publish both the generated asset and updated HTML. Preserve prior hashed assets while cached pages may still reference them.

Current-photo safeguard: until extraction finishes, whole-image classification is disabled. When **more than two** foreground candidates are found in that single photo, the right panel automatically displays individual predictions and suppresses the whole-image result, confidence bars and result export. A per-photo revision discards older scene counts when a newer photo arrives. Extraction failure keeps classification blocked until retry. Collection size does not determine this safeguard.

After a catch, the cutout drops through the outlet, travels along the sorting chute, and falls into one of the six predicted-material bins with a swinging lid, particles and a per-bin counter. Below-threshold or ambiguous predictions route to a seventh **Needs confirmation** area. These are material-learning game bins, not municipal disposal instructions. Clearing/restarting cancels the active flight and resets bin counts.

- Camera preview runs serial local inference with a minimum 650 ms interval and no frame backlog. Still-image extraction takes priority; results from stopped streams are discarded. Camera stops when the page is hidden, after capture, or on explicit close.
- Upload/drop up to 12 JPG/PNG/WebP/BMP photos (20 MB each). Each photo is automatically segmented; review and confirm the extracted transparent cutouts. Exact repeated cutout fingerprints are skipped. The session holds up to 24 candidate/confirmed items and is not persisted on reload.
- Drag a rectangle over the preview to re-segment a missed or touching object. Remove the original merged candidate before confirming separate selections.
- RE:CATCH unlocks only after two items are confirmed. Move with the left/right buttons (hold), or focus the game and use arrow keys. Space or Grab starts a positional catch animation. Restart reloads the confirmed collection. Clear empties the collection and cancels pending extraction results.
- U2NETP saliency segmentation (320x320) generates a foreground mask; connected components above 0.45 are cropped and separately classified by the original six-material classifier. Very small components are filtered. This does not determine whether an object is waste, and does not reliably separate occluded/overlapping items. Transparent materials and complex scenes may fail. Review is required.
- The reported 89.18% remains the original single-image TrashNet classifier result. It is not a measurement of segmentation, live video, or cropped-object classification.
- All models and runtime assets are bundled locally. No inference endpoint, photo upload service, or new external runtime dependency is used.
