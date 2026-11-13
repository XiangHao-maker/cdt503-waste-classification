# XIANG Hao · CDT503 Waste Classification

**Live demo:** https://xianghao-maker.github.io/cdt503-waste-classification/

Upload a photo or take a snapshot with a device camera. Classify a single item into six TrashNet material categories: cardboard, glass, metal, paper, plastic, and trash.

The browser runs the bundled ONNX model locally. Images are not uploaded to an inference server. On a phone, choose a photo from the gallery; on supported devices the camera tab can also capture a snapshot after permission is granted. Use a current Chrome, Edge, or Safari browser and wait for model loading to finish.

## Model and evaluation

- Frozen ImageNet MobileNetV3-Large V2 feature extractor and class-balanced multinomial logistic regression head; not end-to-end fine-tuning.
- Author-sourced TrashNet, 2,527 original images; three exact pixel duplicates removed. Fixed seed 503, stratified train/validation/test split 1,766/379/379.
- Validation selects training augmentation and regularization, and fits temperature scaling. Held-out test accuracy **89.18%**, macro F1 **0.8724**.
- Camera/mobile real-world accuracy has not been independently measured. Six material labels are not equivalent to a city's waste-bin categories; no food, battery, hazardous-waste, or multi-object detection support.
- Full metrics and source provenance are in `reports/`; failed test examples are displayed in the application. Source and third-party notices are in `THIRD_PARTY_NOTICES.md`, `licenses/`, and `vendor/LICENSE`.

## Hosting

Buildless static HTML/CSS/JS, ONNX Runtime Web 1.22.0. GitHub Pages publishes the root of the `main` branch. All assets use relative paths and are served over HTTPS. Camera access requires user permission and supported hardware. HTTPS deployment does not itself verify physical camera performance.

This repository contains the deployable website. Training code, raw data, course materials, and local QA records remain in the owner's separate local final project2 folder.
