require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 5000;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());

app.use(
    express.json({
        limit: "2mb"
    })
);

// ============================================================
// FRONTEND
// ============================================================

const frontendCandidates = [
    path.join(__dirname, "frontend"),
    path.join(__dirname, "..", "frontend")
];

const foundFrontendPath =
    frontendCandidates.find((folder) =>
        fs.existsSync(folder)
    );

const FRONTEND_PATH =
    foundFrontendPath || frontendCandidates[0];

// Fail loudly if the frontend folder wasn't found, instead of
// silently falling back to a path that doesn't exist. This is
// what previously caused express.static to match nothing, and
// every request (including /app.js) to fall through to the
// catch-all handler below, which served index.html's HTML
// content in place of the real JS/CSS files.

if (!foundFrontendPath) {

    console.warn(
        "WARNING: No 'frontend' folder found at either of:\n" +
        frontendCandidates
            .map((candidate) => "  - " + candidate)
            .join("\n") +
        "\nStatic files (app.js, style.css, images, etc.) will " +
        "NOT be served correctly until this is fixed. Falling " +
        "back to: " + FRONTEND_PATH
    );

} else {

    console.log(
        "Serving frontend from: " + FRONTEND_PATH
    );
}

app.use(
    express.static(FRONTEND_PATH, {

        // Disable caching for static assets during development
        // so browsers always fetch the latest app.js/style.css
        // instead of reusing a stale cached copy. Remove/relax
        // this once the app is deployed to production.

        etag: false,

        lastModified: false,

        cacheControl: false,

        setHeaders: (res) => {

            res.setHeader(
                "Cache-Control",
                "no-store, no-cache, must-revalidate"
            );
        }
    })
);

// ============================================================
// MULTER
// ============================================================

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {

        if (
            !file.mimetype ||
            !file.mimetype.startsWith("image/")
        ) {
            return cb(
                new Error("Only image files are allowed.")
            );
        }

        cb(null, true);
    }
});

// ============================================================
// CONFIG
// ============================================================

app.get("/config", (req, res) => {

    const requiredVariables = [
        "NFT_ADDRESS",
        "MARKETPLACE_ADDRESS",
        "LOYALTY_ADDRESS",
        "PINATA_GATEWAY"
    ];

    const missing =
        requiredVariables.filter(
            (variable) =>
                !process.env[variable]
        );

    if (missing.length > 0) {

        return res.status(500).json({
            success: false,
            message:
                "Missing environment variables: " +
                missing.join(", ")
        });
    }

    res.json({
        success: true,

        nft:
            process.env.NFT_ADDRESS,

        marketplace:
            process.env.MARKETPLACE_ADDRESS,

        loyalty:
            process.env.LOYALTY_ADDRESS,

        pinataGateway:
            process.env.PINATA_GATEWAY
    });
});

// ============================================================
// UPLOAD IMAGE
// ============================================================

app.post(
    "/upload-image",
    upload.single("image"),
    async (req, res) => {

        try {

            if (!process.env.PINATA_JWT) {

                return res.status(500).json({
                    success: false,
                    message:
                        "PINATA_JWT is not configured."
                });
            }

            if (!req.file) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Please select an image."
                });
            }

            const formData =
                new FormData();

            formData.append(
                "file",
                req.file.buffer,
                {
                    filename:
                        req.file.originalname,

                    contentType:
                        req.file.mimetype
                }
            );

            const response =
                await axios.post(
                    "https://api.pinata.cloud/pinning/pinFileToIPFS",
                    formData,
                    {
                        headers: {
                            ...formData.getHeaders(),

                            Authorization:
                                `Bearer ${process.env.PINATA_JWT}`
                        },

                        maxContentLength:
                            Infinity,

                        maxBodyLength:
                            Infinity,

                        timeout:
                            120000
                    }
                );

            const cid =
                response.data?.IpfsHash;

            if (!cid) {

                throw new Error(
                    "Pinata did not return an IPFS CID."
                );
            }

            res.json({
                success: true,

                imageURL:
                    `ipfs://${cid}`
            });

        } catch (error) {

            console.error(
                "Image upload error:",
                error.response?.data ||
                error.message
            );

            res.status(500).json({
                success: false,

                message:
                    error.response?.data?.error ||
                    error.response?.data?.message ||
                    error.message ||
                    "Image upload failed."
            });
        }
    }
);

// ============================================================
// UPLOAD METADATA
// ============================================================

app.post(
    "/upload-metadata",
    async (req, res) => {

        try {

            if (!process.env.PINATA_JWT) {

                return res.status(500).json({
                    success: false,
                    message:
                        "PINATA_JWT is not configured."
                });
            }

            const name =
                String(
                    req.body?.name || ""
                ).trim();

            const image =
                String(
                    req.body?.image || ""
                ).trim();

            if (
                !name ||
                !image
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Name and image are required."
                });
            }

            const metadata = {
                name,
                image
            };

            const response =
                await axios.post(
                    "https://api.pinata.cloud/pinning/pinJSONToIPFS",

                    metadata,

                    {
                        headers: {
                            "Content-Type":
                                "application/json",

                            Authorization:
                                `Bearer ${process.env.PINATA_JWT}`
                        },

                        timeout:
                            120000
                    }
                );

            const cid =
                response.data?.IpfsHash;

            if (!cid) {

                throw new Error(
                    "Pinata did not return an IPFS CID."
                );
            }

            res.json({
                success: true,

                metadataURI:
                    `ipfs://${cid}`
            });

        } catch (error) {

            console.error(
                "Metadata upload error:",
                error.response?.data ||
                error.message
            );

            res.status(500).json({
                success: false,

                message:
                    error.response?.data?.error ||
                    error.response?.data?.message ||
                    error.message ||
                    "Metadata upload failed."
            });
        }
    }
);

// ============================================================
// FRONTEND FALLBACK
// ============================================================
//
// Only fall back to index.html for actual page navigations
// (GET requests with no file extension, e.g. client-side
// routes). Requests for missing static assets - app.js,
// style.css, images, etc. - should 404 instead of silently
// receiving index.html's HTML content back, which is what
// was happening before and made a missing/misplaced app.js
// look like "the old file is still loading" in the browser.

app.use((req, res) => {

    const looksLikeAssetRequest =
        path.extname(req.path) !== "";

    if (
        req.method !== "GET" ||
        looksLikeAssetRequest
    ) {

        return res.status(404).json({
            success: false,
            message: `Not found: ${req.path}`
        });
    }

    res.sendFile(
        path.join(
            FRONTEND_PATH,
            "index.html"
        )
    );
});

// ============================================================
// START SERVER
// ============================================================

if (require.main === module) {

    app.listen(
        PORT,
        () => {
            console.log(
                `Server running on http://localhost:${PORT}`
            );
        }
    );
}

module.exports = app;