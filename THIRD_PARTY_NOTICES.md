# Third-party sources

- TrashNet: Gary Thung and Mindy Yang (2016), https://github.com/garythung/trashnet . Original-author archive pinned to commit 6fa2b878c6c1b4304b91109070ce0edf9279bb31. Keep the source attribution and original repository LICENSE (MIT). This project does not assert additional ownership or a broader license for the dataset. Data consists of six material categories photographed mainly on white posterboard.
- Torchvision MobileNetV3-Large ImageNet V2 weights: https://docs.pytorch.org/vision/stable/models/mobilenetv3.html . Torchvision source is BSD-3-Clause; the pretrained-weight training data have their own terms. See `licenses/torchvision-LICENSE`.
- ONNX Runtime Web 1.22.0, https://github.com/microsoft/onnxruntime . MIT license in `vendor/LICENSE`. Local runtime files were copied from the original project's verified npm package and their hashes were rechecked in this project.
- Sample photos and failure illustrations are genuine images from the fixed held-out TrashNet test split. They are not AI-generated assets and not a separate real-world camera evaluation.

Model: frozen ImageNet MobileNetV3-Large feature extractor + a supervised class-balanced multinomial logistic head trained by this project. Not a reproduction of the authors' original TrashNet model.
# Added foreground extraction model (2026-11-18)

`models/u2netp.onnx`: U²-Net lightweight salient-object segmentation by Xuebin Qin et al.; source https://github.com/xuebinqin/U-2-Net (upstream Apache-2.0 text in `licenses/U2NET-LICENSE.txt`). ONNX weights distributed by rembg at https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx. Download MD5: `8e83ca70e441ab06c318d82300c84806`. This is a pretrained third-party foreground model, not a model trained on this project's garbage classes. The release asset has no separate conversion record; provenance is recorded here without implying evaluation on this project's data.
# Matter.js physics engine

`vendor/matter.min.js`, version 0.20.0, by Liam Brummitt and contributors. MIT license: `licenses/MATTER-LICENSE.txt`. Source: https://github.com/liabru/matter-js ; bundled distribution: https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js . SHA-256: `72d30be0f579eb02ce1e0b6f9d359a4f392e6837e5a26ba8be5dbee7f88e24ae`.
