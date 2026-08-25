// redeploy export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { randomUUID } from "crypto";

// 1. Variabel cache (AMAN di global scope karena hanya deklarasi)
let cachedClient = null;
let cachedDb = null;

// 2. Fungsi Helper untuk Koneksi (Hanya jalan saat dipanggil, BUKAN saat build)
async function getConnectedDb() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const uri = process.env.MONGO_URL;
  if (!uri) {
    throw new Error('MONGO_URL environment variable is not defined');
  }

  // Inisialisasi MongoClient DI SINI (Runtime), bukan di baris 7 seperti sebelumnya
  const client = new MongoClient(uri);
  await client.connect();
  
  // PENTING: Nama database disesuaikan dengan screenshot MongoDB Atlas Anda
  const db = client.db('Harmony_mountain'); 
  
  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

// 3. Data Default (Sama seperti kode asli Anda)
const defaults = {
  impact_categories: [
    { id: "school-transport", name: "Transportasi sekolah", icon: "🚌" },
    { id: "school-meals", name: "Gizi & makan siang", icon: "" },
    { id: "digital-access", name: "Peralatan digital & kuota", icon: "💻" },
  ],
  hosts: [
    { id: "host-ibu-sari", name: "Ibu Sari", location: "Lereng Lawu" },
    { id: "host-pak-damar", name: "Kak Damar", location: "Kaki Gunung" },
  ],
  packages: [
    { id: "pkg-sawah-pagi", host_id: "host-ibu-sari", title: "Pagelaran Sawah" },
    { id: "pkg-jejak-bromo", host_id: "host-pak-damar", title: "Jejak Bromo" },
  ],
};

// 4. Fungsi Seed (Sama seperti kode asli Anda)
async function ensureSeed(database) {
  for (const [collection, items] of Object.entries(defaults)) {
    if (await database.collection(collection).countDocuments() === 0) {
      await database.collection(collection).insertMany(items.map(item => ({
        ...item,
        _id: item.id || randomUUID(),
        created_at: new Date()
      })));
    }
  }
}

// 5. Handler GET (Memanggil helper getConnectedDb)
export async function GET(request, { params }) {
  try {
    // Panggil helper untuk mendapatkan koneksi DB yang valid
    const { db } = await getConnectedDb();
    
    // Jalankan seed data jika collection masih kosong
    await ensureSeed(db);
    
    // Logika routing dinamis sesuai kode asli Anda
    const path = (await params)?.path || [];
    
    // Contoh logika sederhana (sesuaikan dengan kebutuhan API Anda)
    if (path.length === 0) {
       const packages = await db.collection('packages').find({}).toArray();
       return NextResponse.json({ success: true, data: packages });
    }
    
    return NextResponse.json({ message: "Route found", path });
    
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error", details: error.message }, 
      { status: 500 }
    );
  }
}
