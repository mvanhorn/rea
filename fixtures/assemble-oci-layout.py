#!/usr/bin/env python3
"""Assemble a tiny OCI image-layout directory. skopeo/buildah/docker were not installed."""

from __future__ import annotations

import hashlib
import json
import shutil
from pathlib import Path


def put(root: Path, data: bytes) -> tuple[str, int]:
    digest_hex = hashlib.sha256(data).hexdigest()
    path = root / "blobs" / "sha256" / digest_hex
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return f"sha256:{digest_hex}", len(data)


def assemble(root: Path) -> None:
    if root.exists():
        shutil.rmtree(root)
    root.mkdir(parents=True)
    layer, layer_size = put(root, b"demo-layer-bytes\n")
    config = {
        "architecture": "amd64",
        "os": "linux",
        "created": "2024-01-02T03:04:05Z",
        "author": "demo@example.invalid",
        "config": {
            "User": "nobody",
            "Env": ["PATH=/usr/bin", "SECRET=redact-me"],
            "Entrypoint": ["/bin/sh"],
            "Cmd": ["-c", "true"],
            "WorkingDir": "/",
            "ExposedPorts": {"80/tcp": {}},
            "Volumes": {"/data": {}},
            "Labels": {"org.opencontainers.image.title": "demo"},
            "StopSignal": "SIGTERM",
        },
        "rootfs": {"type": "layers", "diff_ids": [layer]},
        "history": [
            {
                "created": "2024-01-02T03:04:05Z",
                "created_by": "/bin/sh -c #(nop) ADD layer",
                "empty_layer": False,
            },
            {
                "created": "2024-01-02T03:04:06Z",
                "created_by": "/bin/sh -c #(nop) ENV SECRET=redact-me",
                "empty_layer": True,
            },
        ],
    }
    config_digest, config_size = put(root, (json.dumps(config) + "\n").encode())
    manifest = {
        "schemaVersion": 2,
        "mediaType": "application/vnd.oci.image.manifest.v1+json",
        "config": {
            "mediaType": "application/vnd.oci.image.config.v1+json",
            "digest": config_digest,
            "size": config_size,
        },
        "layers": [
            {
                "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
                "digest": layer,
                "size": layer_size,
            }
        ],
    }
    manifest_digest, manifest_size = put(root, (json.dumps(manifest) + "\n").encode())
    index = {
        "schemaVersion": 2,
        "mediaType": "application/vnd.oci.image.index.v1+json",
        "manifests": [
            {
                "mediaType": "application/vnd.oci.image.manifest.v1+json",
                "digest": manifest_digest,
                "size": manifest_size,
                "platform": {"architecture": "amd64", "os": "linux"},
                "annotations": {"org.opencontainers.image.ref.name": "latest"},
            }
        ],
    }
    (root / "index.json").write_bytes((json.dumps(index) + "\n").encode())
    (root / "oci-layout").write_bytes(
        (json.dumps({"imageLayoutVersion": "1.0.0"}) + "\n").encode()
    )
    print(f"wrote {root}")
    print(f"manifest {manifest_digest}")
    print(f"layer {layer}")


if __name__ == "__main__":
    assemble(Path("/tmp/oci-demo/busybox.oci"))
