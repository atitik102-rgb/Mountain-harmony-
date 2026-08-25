import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { randomUUID } from "crypto";

// 1. Variabel cache global
let cachedClient = null;
let cachedDb = null;

async function getConnectedDb() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGO_URL;
  if (!uri) {
    throw new Error('MONGO_URL environment variable is not defined');
  }

  const client = new MongoClient(uri);
  await client.connect();
  
  // Pastikan nama database sesuai dengan yang ada di MongoDB Atlas Anda
  const db = client.db('Harmony_mountain'); 

  cachedClient = client;
  cachedDb = db;
  return { client, db };
}

// Data Default
const defaults = {
  packages: [
    { 
      id: "pkg-sawah-pagi", 
      host_id: "host-ibu-sari", 
      title: "Sawah Pagi & Kopi Desa", 
      price: 150000, 
      description: "Nikmati pagi di tengah sawah terasering." 
    },
    { 
      id: "pkg-jejak-bromo", 
      host_id: "host-pak-damar", 
      title: "Jejak Bromo Sunrise", 
      price: 350000, 
      description: "Petualangan sunrise di kaki gunung berapi." 
    }
  ],
  hosts: [
    { id: "host-ibu-sari", name: "Ibu Sari", location: "Dieng" },
    { id: "host-pak-damar", name: "Pak Damar", location: "Probolinggo" }
  ]
};

async function ensureSeed(db) {
  try {
    for (const [collectionName, items] of Object.entries(defaults)) {
      const collection = db.collection(collectionName);
      const count = await collection.countDocuments();
      
      if (count === 0) {
        console.log(`Seeding collection: ${collectionName}`);
        await collection.insertMany(items.map(item => ({
          ...item,
          _id: item.id || randomUUID(),
          created_at: new Date()
        })));
      }
    }
  } catch (err) {
    console.error("Seed Error:", err);
  }
}

// Handler GET yang Disederhanakan (Tanpa params)
export async function GET(request) {
  try {
    console.log('[START] Request masuk ke API');
    
    const { db } = await getConnectedDb();
    console.log('[OK] Database terhubung');
    
    // Jalankan seeding otomatis
    await ensureSeed(db);
    
    // Ambil semua data packages
    const packages = await db.collection('packages').find({}).toArray();
    console.log(`[DATA] Berhasil mengambil ${packages.length} packages`);

    return NextResponse.json({ 
      success: true, 
      data: packages 
    });

  } catch (error) {
    console.error("[FATAL ERROR]", error);
    return NextResponse.json(
      { error: "Server Error", details: error.message }, 
      { status: 500 }
    );
  }
}
