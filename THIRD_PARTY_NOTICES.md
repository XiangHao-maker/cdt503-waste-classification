# Third-party sources

- TrashNet: Gary Thung and Mindy Yang (2016), https://github.com/garythung/trashnet . Original-author archive pinned to commit 6fa2b878c6c1b4304b91109070ce0edf9279bb31. Keep the source attribution and original repository LICENSE (MIT). This project does not assert additional ownership or a broader license for the dataset. Data consists of six material categories photographed mainly on white posterboard.
- Torchvision MobileNetV3-Large ImageNet V2 weights: https://docs.pytorch.org/vision/stable/models/mobilenetv3.html . Torchvision source is BSD-3-Clause; the pretrained-weight training data have their own terms. See `licenses/torchvision-LICENSE`.
- ONNX Runtime Web 1.22.0, https://github.com/microsoft/onnxruntime . MIT license in `vendor/LICENSE`. Local runtime files were copied from the original project's verified npm package and their hashes were rechecked in this project.
- Sample photos and failure illustrations are genuine images from the fixed held-out TrashNet test split. They are not AI-generated assets and not a separate real-world camera evaluation.

Model: frozen ImageNet MobileNetV3-Large feature extractor + a supervised class-balanced multinomial logistic head trained by this project. Not a reproduction of the authors' original TrashNet model.
