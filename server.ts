import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";

console.log("Starting server initialization...");

// Load Firebase Config
let firebaseConfig: any;
try {
  firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
  console.log("Firebase config loaded.");
} catch (error) {
  console.error("Failed to load firebase-applet-config.json:", error);
  process.exit(1);
}

// Initialize Firebase Admin
let firebaseApp: any;
try {
  if (!getApps().length) {
    firebaseApp = initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log("Firebase Admin initialized with project:", firebaseConfig.projectId);
  } else {
    firebaseApp = getApps()[0];
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
  firebaseApp = getApps()[0];
}

let db: any;
try {
  db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  console.log("Firestore initialized with database:", firebaseConfig.firestoreDatabaseId);
} catch (error) {
  console.error("Failed to initialize named Firestore database, falling back to default:", error);
  db = getFirestore(firebaseApp);
}
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const adminAuth = getAuth(firebaseApp);

async function startServer() {
  try {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    app.get("/api/ping", (req, res) => {
      res.json({ status: "ok", time: new Date().toISOString() });
    });

    // Health check
    app.get("/api/health", async (req, res) => {
      try {
        await db.collection("health").limit(1).get();
        res.json({ status: "ok", firestore: "connected" });
      } catch (error: any) {
        res.status(500).json({ status: "error", message: error.message });
      }
    });

    // --- Auth Endpoints ---

    // Login with Firebase Token (Google Login)
    app.post("/api/auth/google-login", async (req, res) => {
      const { idToken } = req.body;
      
      if (!idToken) {
        return res.status(400).json({ error: "ID Token required" });
      }

      try {
        console.log("[AUTH] Verifying Firebase ID Token...");
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const email = decodedToken.email;
        const name = decodedToken.name || email?.split('@')[0];

        console.log(`[AUTH] User verified: ${email} (${uid})`);

        // Check if user exists in our records, if not, create a basic profile
        let userData: any = {
          uid,
          email,
          username: name,
          role: 'admin', // Default to admin for the first users in this dev environment
          active: true
        };

        try {
          if (db) {
            const userDoc = await db.collection("users").doc(uid).get();
            if (userDoc.exists) {
              userData = { ...userData, ...userDoc.data() };
            } else {
              // Auto-register the user if they don't exist
              await db.collection("users").doc(uid).set(userData);
            }
          }
        } catch (dbError: any) {
          console.warn("[AUTH] Could not sync with Firestore, proceeding with token data:", dbError.message);
        }

        const token = jwt.sign(
          { uid, email, role: userData.role },
          JWT_SECRET,
          { expiresIn: "7d" }
        );

        res.json({ 
          token, 
          firebaseToken: idToken,
          user: userData 
        });
      } catch (error: any) {
        console.error("[AUTH] Google Login error:", error);
        res.status(401).json({ error: "Invalid Firebase token", message: error.message });
      }
    });

    // Startup check for Firestore
    const testFirestore = async () => {
      try {
        console.log("[STARTUP] Testing Firestore connectivity...");
        const testSnap = await db.collection("users").limit(1).get();
        console.log("[STARTUP] Firestore connected successfully. Users found:", !testSnap.empty);
      } catch (error: any) {
        console.error("[STARTUP] Firestore connection test failed:", error.message);
        if (error.code === 7 || error.message.includes("PERMISSION_DENIED")) {
          console.error("[STARTUP] CRITICAL: Permission denied. Please check Firebase configuration and IAM permissions.");
        }
      }
    };
    testFirestore();

  // Check if root user has a password set
  app.get("/api/auth/status", async (req, res) => {
    try {
      console.log("Checking auth status...");
      const rootSnap = await db.collection("users").where("username", "==", "root").limit(1).get();
      console.log("Auth status check complete. Empty:", rootSnap.empty);
      
      if (rootSnap.empty) {
        return res.json({ initialized: false });
      }

      const rootData = rootSnap.docs[0].data();
      res.json({ initialized: !!rootData.passwordHash });
    } catch (error: any) {
      console.error("Auth status error details:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: error.message, 
        code: error.code,
        stack: error.stack 
      });
    }
  });

  // Set initial root password
  app.post("/api/auth/setup", async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters" });
    }

    try {
      console.log("Starting setup...");
      const rootSnap = await db.collection("users").where("username", "==", "root").limit(1).get();
      
      if (!rootSnap.empty) {
        const rootData = rootSnap.docs[0].data();
        if (rootData.passwordHash) {
          return res.status(400).json({ error: "System already initialized" });
        }
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      if (rootSnap.empty) {
        console.log("Creating root user...");
        // Create root user if it doesn't exist
        // Find a company or create one
        const companiesSnap = await db.collection("companies").limit(1).get();
        let companyId;
        if (companiesSnap.empty) {
          const companyRef = await db.collection("companies").add({ name: "Empresa Principal" });
          companyId = companyRef.id;
        } else {
          companyId = companiesSnap.docs[0].id;
        }

        await db.collection("users").add({
          username: "root",
          email: "root@control.com",
          role: "admin",
          companyId: companyId,
          active: true,
          mustChangePassword: false,
          passwordHash
        });
        console.log("Root user created.");
      } else {
        console.log("Updating existing root user...");
        // Update existing root user
        await rootSnap.docs[0].ref.update({ 
          passwordHash,
          mustChangePassword: false 
        });
        console.log("Root user updated.");
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Setup error details:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: error.message,
        code: error.code,
        stack: error.stack
      });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    console.log(`[LOGIN] Attempt for username: ${username}`);
    
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }

    try {
      if (!db) {
        throw new Error("Firestore database (db) is not initialized");
      }

      console.log(`[LOGIN] Querying Firestore for user: ${username}`);
      const userSnap = await db.collection("users").where("username", "==", username).limit(1).get();
      
      if (userSnap.empty) {
        console.log(`[LOGIN] User not found: ${username}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const userData = userSnap.docs[0].data();
      console.log(`[LOGIN] User found. ID: ${userSnap.docs[0].id}`);
      
      if (!userData.passwordHash) {
        console.log(`[LOGIN] Password hash missing for user: ${username}`);
        return res.status(401).json({ error: "Password not set. Please initialize the system." });
      }

      console.log(`[LOGIN] Comparing passwords...`);
      const isMatch = await bcrypt.compare(password, userData.passwordHash);
      if (!isMatch) {
        console.log(`[LOGIN] Password mismatch for user: ${username}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (userData.active === false) {
        console.log(`[LOGIN] Account inactive: ${username}`);
        return res.status(403).json({ error: "Account is inactive" });
      }

      console.log(`[LOGIN] Generating JWT...`);
      const token = jwt.sign(
        { uid: userSnap.docs[0].id, username: userData.username, role: userData.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      let firebaseToken = null;
      try {
        console.log(`[LOGIN] Creating Firebase custom token for UID: ${userSnap.docs[0].id}`);
        firebaseToken = await adminAuth.createCustomToken(userSnap.docs[0].id);
        console.log("[LOGIN] Firebase custom token created successfully.");
      } catch (authError: any) {
        console.error("[LOGIN] Error creating firebase custom token:", authError.message);
        // Non-fatal error for the main login flow
      }

      console.log(`[LOGIN] Login successful for user: ${username}`);
      res.json({ 
        token, 
        firebaseToken,
        user: { ...userData, uid: userSnap.docs[0].id } 
      });
    } catch (error: any) {
      console.error("[LOGIN] Critical error details:", error);
      res.status(500).json({ 
        error: "Internal server error", 
        message: error.message,
        code: error.code,
        stack: error.stack
      });
    }
  });

  // Get current user
  app.get("/api/auth/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const userDoc = await db.collection("users").doc(decoded.uid).get();
      
      if (!userDoc.exists) {
        return res.status(401).json({ error: "User not found" });
      }

      const userData = userDoc.data();
      const firebaseToken = await auth.createCustomToken(userDoc.id);
      
      res.json({ ...userData, uid: userDoc.id, firebaseToken });
    } catch (error) {
      res.status(401).json({ error: "Invalid token" });
    }
  });

  // --- Vite / Static Files ---

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Critical error during server startup:", error);
    process.exit(1);
  }
}

startServer();
