export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { randomUUID } from "crypto";

const client = new MongoClient(process.env.MONGO_URL);
let databasePromise;
const db = async () => {
  if (!databasePromise) databasePromise = client.connect().then((c) => c.db());
  return databasePromise;
};

const defaults = {
  impact_categories: [
    { id: "school-transport", name: "Transportasi sekolah", icon: "🚐", allocation_percent: 2, active: true, is_default: true },
    { id: "school-meals", name: "Gizi & makan siang", icon: "🥣", allocation_percent: 2, active: true, is_default: true },
    { id: "digital-access", name: "Peralatan digital & kuota", icon: "📱", allocation_percent: 1, active: true, is_default: true },
  ],
  hosts: [
    { id: "host-ibu-sari", name: "Ibu Sari", location: "Lereng Lawu", photo: "", story: "Dari dapur kecil, Sari merawat rasa dan membuka pintu rumah bagi para pejalan.", skills: ["Masakan rumahan", "Cerita budaya"], rating: 4.9, impact_total: 1865000, verified: true },
    { id: "host-pak-damar", name: "Kak Damar", location: "Kaki Gunung Bromo", photo: "", story: "Memandu dengan tenang, menjaga jalur tetap bersih, dan memastikan tamu pulang membawa cerita.", skills: ["Pemandu alam", "Fotografi"], rating: 4.8, impact_total: 1220000, verified: true },
  ],
  packages: [
    { id: "pkg-sawah-pagi", host_id: "host-ibu-sari", title: "Pagi di Sawah & Dapur Sari", type: "Kuliner & budaya", location: "Lereng Lawu", price: 285000, duration: "1 hari", description: "Belajar menanam, memetik sayur, lalu memasak resep keluarga bersama Ibu Sari.", accent: "amber" },
    { id: "pkg-jejak-bromo", host_id: "host-pak-damar", title: "Jejak Sunyi Bromo", type: "Alam & homestay", location: "Kaki Bromo", price: 640000, duration: "2 hari 1 malam", description: "Jalur pelan, langit luas, dan homestay hangat yang dikelola warga lokal.", accent: "teal" },
  ],
};

async function ensureSeed(database) {
  for (const [collection, items] of Object.entries(defaults)) {
    if (await database.collection(collection).countDocuments() === 0) {
      await database.collection(collection).insertMany(items.map((item) => ({ ...item, created_at: new Date() })));
    }
  }
}

const json = (data, status = 200) => NextResponse.json(data, { status });

export async function GET(request, { params }) {
  try {
    const database = await db(); await ensureSeed(database);
    const path = (await params)?.path || [];
    const resource = path[0] || "overview";
    if (resource === "packages") return json({ packages: await database.collection("packages").find({ active: { $ne: false } }).toArray() });
    if (resource === "hosts") return json({ hosts: await database.collection("hosts").find().toArray() });
    if (resource === "categories") return json({ categories: await database.collection("impact_categories").find({ active: { $ne: false } }).toArray() });
    if (resource === "bookings") return json({ bookings: await database.collection("bookings").find().sort({ created_at: -1 }).limit(30).toArray() });
    const totals = await database.collection("education_funds").aggregate([{ $group: { _id: "$allocation_category", total: { $sum: "$amount" } } }, { $sort: { total: -1 } }]).toArray();
    const bookingCount = await database.collection("bookings").countDocuments({ status: { $ne: "cancelled" } });
    return json({ totals: totals.map((row) => ({ category: row._id, total: row.total })), bookingCount, pillars: 3 });
  } catch (error) { return json({ error: "Database belum siap", detail: error.message }, 500); }
}

export async function POST(request, { params }) {
  try {
    const database = await db(); await ensureSeed(database);
    const path = (await params)?.path || [];
    const body = await request.json();
    if (path[0] === "bookings") {
      const pkg = await database.collection("packages").findOne({ id: body.package_id });
      if (!pkg) return json({ error: "Paket tidak ditemukan" }, 404);
      const categories = await database.collection("impact_categories").find({ active: { $ne: false }, is_default: true }).toArray();
      const booking = { id: randomUUID(), package_id: pkg.id, package_title: pkg.title, host_id: pkg.host_id, guest_name: body.guest_name || "Wisatawan", guest_count: Math.max(1, Number(body.guest_count) || 1), travel_date: body.travel_date || null, total_amount: pkg.price * Math.max(1, Number(body.guest_count) || 1), status: "confirmed", created_at: new Date() };
      const allocations = categories.map((category) => ({ id: randomUUID(), booking_id: booking.id, host_id: pkg.host_id, allocation_category: category.name, amount: Math.round(booking.total_amount * category.allocation_percent / 100), percent: category.allocation_percent, verified: true, created_at: new Date() }));
      await database.collection("bookings").insertOne(booking);
      if (allocations.length) await database.collection("education_funds").insertMany(allocations);
      await database.collection("hosts").updateOne({ id: pkg.host_id }, { $inc: { impact_total: allocations.reduce((sum, item) => sum + item.amount, 0) } });
      return json({ booking, allocations }, 201);
    }
    if (path[0] === "categories") {
      const category = { id: body.id || randomUUID(), name: body.name, icon: body.icon || "✦", allocation_percent: Number(body.allocation_percent) || 1, active: true, is_default: body.is_default !== false, created_at: new Date() };
      if (!category.name) return json({ error: "Nama kategori wajib diisi" }, 400);
      await database.collection("impact_categories").insertOne(category); return json({ category }, 201);
    }
    return json({ error: "Endpoint tidak ditemukan" }, 404);
  } catch (error) { return json({ error: "Permintaan gagal", detail: error.message }, 500); }
}

export async function PUT(request, { params }) {
  try {
    const database = await db(); const path = (await params)?.path || []; const body = await request.json();
    if (path[0] === "hosts" && path[1]) {
      const allowed = { story: body.story, skills: body.skills, photo: body.photo, name: body.name, location: body.location };
      await database.collection("hosts").updateOne({ id: path[1] }, { $set: allowed });
      return json({ host: await database.collection("hosts").findOne({ id: path[1] }) });
    }
    return json({ error: "Endpoint tidak ditemukan" }, 404);
  } catch (error) { return json({ error: "Pembaruan gagal", detail: error.message }, 500); }
}
