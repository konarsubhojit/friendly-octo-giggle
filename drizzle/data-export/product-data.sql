-- Product data export
-- Exported at: 2026-03-21T19:50:39.985Z

-- Products
INSERT INTO "Product" ("id", "name", "description", "price", "image", "images", "stock", "category", "deletedAt", "createdAt", "updatedAt") VALUES
  ('XKMnLpf', 'Tulip pot ', 'Crochet floral basket and coaster ', 250, 'https://nxwhpbnulyausljf.public.blob.vercel-storage.com/1000026569-qk11JiJdRz5VVSjF0UqiJFA9LCwcQ5.jpg', '[]'::json, 26397, 'Decors', NULL, '2026-03-07T18:28:38.388Z', '2026-03-21T13:49:14.900Z'),
  ('4xgVwvW', 'Crochet handbag', 'Crochet handbag ', 500, 'https://nxwhpbnulyausljf.public.blob.vercel-storage.com/1000026568-qWWdtyCIDeDWPlU1hw6sbnwNkByCKi.jpg', '[]'::json, 29797, 'Handbag', NULL, '2026-03-07T18:35:47.084Z', '2026-03-21T13:48:35.996Z'),
  ('OIWKWb3', 'Crochet drawstring bag ', 'Crochet handbag ', 500, 'https://nxwhpbnulyausljf.public.blob.vercel-storage.com/1000026566-T2I0bc88IX4Wt4cl3F9wdFKP31NSNT.jpg', '[]'::json, 42997, 'Handbag', NULL, '2026-03-07T18:36:26.528Z', '2026-03-21T13:48:20.489Z'),
  ('04hMsA1', 'Crochet handbag', 'Crochet handbag ', 850, 'https://nxwhpbnulyausljf.public.blob.vercel-storage.com/1000026269-CUHoNvhkfyFbmVqwQf2ILtj0n9X64J.jpg', '[]'::json, 12496, 'Handbag', NULL, '2026-03-07T18:37:16.089Z', '2026-03-21T13:48:05.924Z'),
  ('htpFpFo', 'Lily flower pot ', 'Lily flower pot ', 350, 'https://nxwhpbnulyausljf.public.blob.vercel-storage.com/1000025381-51VeollfEnbiSH5ORHMrFAEzovoGYA.jpg', '[]'::json, 14798, 'Flower Pots', NULL, '2026-03-15T00:20:51.066Z', '2026-03-21T13:47:51.794Z'),
  ('EDpRgph', 'Gajra', 'Floral gajra', 250, 'https://nxwhpbnulyausljf.public.blob.vercel-storage.com/1000026146-xk27zrdgeoPyrKFGZigXgOObW06Lif.jpg', '[]'::json, 24799, 'Hair Accessories', NULL, '2026-03-15T00:22:56.892Z', '2026-03-21T13:47:37.068Z'),
  ('mlZ6wCy', 'Fairies flower stems ', 'Stems of fairy flower ', 275, 'https://nxwhpbnulyausljf.public.blob.vercel-storage.com/1000025634-kIjgYZmcZGX1A8OkadiXBqw8nvH3Hw.jpg', '[]'::json, 34997, 'Flowers', NULL, '2026-03-15T00:29:27.983Z', '2026-03-21T13:47:22.313Z');

-- Product Variations
INSERT INTO "ProductVariation" ("id", "productId", "name", "designName", "image", "images", "priceModifier", "stock", "createdAt", "updatedAt") VALUES
  ('AEUbIOe', 'OIWKWb3', 'Blue - white', 'Heart drawstring bag', 'https://nxwhpbnulyausljf.public.blob.vercel-storage.com/1000026565-daaGhQRRMq1U2DiCme3R3nbBqGORt7.jpg', '[]'::json, 0, 5000, '2026-03-19T11:49:49.661Z', '2026-03-21T13:48:56.787Z');
