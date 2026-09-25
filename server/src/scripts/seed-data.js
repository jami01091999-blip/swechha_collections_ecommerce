import { IMG } from './_imgs.js';

const img = (key) => IMG[key].map((url) => ({ url, publicId: '' }));

const SAREE_CARE = ['Strict professional dry clean only.', 'Store wrapped in pure unbleached muslin cloth.', 'Avoid direct spray of perfumes on metallic zari borders.'];
const OCCASION =
  'Best suited for Diwali soirées, intimate wedding rituals, and Sangeet ceremonies. Pair with temple antique gold jewellery and an embellished potli bag.';

export const SEED_PRODUCTS = [
  {
    name: 'Gulmohar Silk Saree', slug: 'gulmohar-silk-saree', code: 'SC-2025-084', category: 'Sarees',
    fabric: 'Pure Tussar Silk with Zari', badge: 'New Arrival', price: 14500, mrp: 24000, images: img('gulmohar'),
    colors: [
      { name: 'Vermilion Crimson', hex: '#8b1e2a' }, { name: 'Mustard Ochre', hex: '#c98e28' },
      { name: 'Deep Royal Emerald', hex: '#1b4332' }, { name: 'Antique Molten Gold', hex: '#b89758' },
    ],
    sizeType: 'free', freeSizeStock: 4,
    sareeDetails: { sareeLength: '5.5 metres', blousePiece: 'Included (Unstitched)', blouseLength: '0.8 metres', blouseFabric: 'Pure Tussar Silk' },
    description: 'The Gulmohar Silk Saree celebrates artisanal Banaras craft heritage. Featuring pure Tussar slub texture, fine gilded floral bel work along the borders, and an opulent zari pallu draped for festive majesty.',
    fabricDetails: ['100% Certified Mulberry Tussar Handloom Silk', 'Zari: Electroplated antique gold metallic cord', 'Origin: Hand-woven in Chanderi & Varanasi'],
    occasion: OCCASION, care: SAREE_CARE, isNewArrival: true, isFeatured: false,
  },
  {
    name: 'Noor Kurta Set', slug: 'noor-kurta-set', code: 'SC-2025-019', category: 'Kurta Sets',
    fabric: 'Chanderi Silk & Organza Dupatta', badge: 'New Arrival', price: 12800, mrp: 18000, images: img('noor'),
    colors: [
      { name: 'Pistachio Mint', hex: '#a3b899' }, { name: 'Blush Powder Rose', hex: '#d4a59a' },
      { name: 'Ivory Champagne', hex: '#dfd7c2' }, { name: 'Lilac Mist', hex: '#b39bc8' },
    ],
    sizeType: 'sized', sizes: [{ label: 'XS', stock: 2 }, { label: 'S', stock: 4 }, { label: 'M', stock: 6 }, { label: 'L', stock: 5 }, { label: 'XL', stock: 1 }, { label: 'XXL', stock: 0 }],
    description: 'The Noor Set embodies ethereal calm in artisanal Chanderi weave. Hand-embroidered with delicate gota patti borders, paired with flared trousers and an airy scalloped organza dupatta.',
    fabricDetails: ['Pure Chanderi Silk with Cotton Mulberry inner lining', 'Hand-done gota patti needlework and fine badla accents'],
    occasion: 'Made for mehendi mornings, festive lunches and daytime pujas.', care: ['Dry clean only.', 'Steam iron on reverse.'],
    isNewArrival: true, isFeatured: false,
  },
  {
    name: 'Chandrika Velvet Lehenga', slug: 'chandrika-velvet-lehenga', code: 'SC-2025-052', category: 'Lehengas',
    fabric: 'Raw Silk with Dabka Work', badge: 'Limited Edition', price: 38000, mrp: 52000, images: img('chandrika'),
    colors: [
      { name: 'Deep Wine Ruby', hex: '#4e051a' }, { name: 'Royal Midnight Navy', hex: '#111d4a' },
      { name: 'Forest Emerald', hex: '#16382c' }, { name: 'Antique Rust', hex: '#873e23' },
    ],
    sizeType: 'sized', sizes: [{ label: 'S', stock: 0 }, { label: 'M', stock: 0 }, { label: 'L', stock: 0 }, { label: 'XL', stock: 0 }],
    description: 'Crafted for royal heritage brides, Chandrika merges velvet borders with rich raw silk. Ornate hand-embroidered dabka and zardozi floral motifs cascade down a dramatic 4.5-metre flair.',
    fabricDetails: ['Handwoven Raw Silk & Micro-Velvet accents', 'Authentic bullion wire, dabka, and nakshi needlecraft'],
    occasion: 'Bridal wear, reception evenings and sangeet nights.', care: ['Professional dry clean only.', 'Store flat in a breathable garment bag.'],
    isNewArrival: true, isFeatured: false,
  },
  {
    name: 'Aarohi Tissue Saree', slug: 'aarohi-tissue-saree', code: 'SC-2025-091', category: 'Sarees',
    fabric: 'Organza Tissue Scalloped', badge: 'Festive Spotlight', price: 16200, mrp: 22000, images: img('aarohi'),
    colors: [
      { name: 'Champagne Glow', hex: '#d8c3aa' }, { name: 'Rose Gold', hex: '#c79389' },
      { name: 'Silver Moonlight', hex: '#c5c6c7' }, { name: 'Copper Bronze', hex: '#9c6644' },
    ],
    sizeType: 'free', freeSizeStock: 6,
    sareeDetails: { sareeLength: '5.5 metres', blousePiece: 'Included (Unstitched)', blouseLength: '0.8 metres', blouseFabric: 'Organza Tissue Brocade' },
    description: 'Translucent and luminous, the Aarohi Saree is woven with fine metallic organza tissue. Hand-cut scalloped borders feature tone-on-tone resham embroidery with subtle micro-sequin reflections.',
    fabricDetails: ['Pure Luminous Metallic Organza Tissue', 'Hand-finished scalloped borders with resham & micro-sequins'],
    occasion: OCCASION, care: SAREE_CARE, isNewArrival: true, isFeatured: false,
  },
  {
    name: 'Virasat Kanjeevaram', slug: 'virasat-kanjeevaram', code: 'SC-2025-063', category: 'Sarees',
    fabric: 'Pure Mulberry Silk', badge: 'Masterpiece', price: 28500, mrp: 39000, images: img('virasat'),
    colors: [
      { name: 'Royal Purple & Gold', hex: '#431c53' }, { name: 'Crimson Scarlet', hex: '#720921' },
      { name: 'Peacock Teal', hex: '#0f4c5c' }, { name: 'Antique Gold Rust', hex: '#a45a2a' },
    ],
    sizeType: 'free', freeSizeStock: 2,
    sareeDetails: { sareeLength: '6.2 metres', blousePiece: 'Included (Unstitched)', blouseLength: '0.8 metres', blouseFabric: 'Heavy Brocade Mulberry Silk' },
    description: 'Woven with three-ply high-twist mulberry silk, Virasat features the sacred temple border and dancing peacock motifs in genuine pure zari. An heirloom to be cherished across generations.',
    fabricDetails: ['Pure Grade-A Mulberry Silk (Korvai weaving technique)', 'Heavy gold zari with silver alloy core'],
    occasion: OCCASION, care: SAREE_CARE, isNewArrival: false, isFeatured: true,
  },
  {
    name: 'Sitara Mirror Kurta', slug: 'sitara-mirror-kurta', code: 'SC-2025-037', category: 'Kurta Sets',
    fabric: 'Georgette with Resham', badge: 'Boutique Spotlight', price: 11200, mrp: 16000, images: img('sitara'),
    colors: [
      { name: 'Haldi Mustard', hex: '#dca11d' }, { name: 'Kashmir Peach', hex: '#f4a261' },
      { name: 'Ocean Turquoise', hex: '#2a9d8f' }, { name: 'Gulabi Rani Pink', hex: '#c83e74' },
    ],
    sizeType: 'sized', sizes: [{ label: 'XS', stock: 3 }, { label: 'S', stock: 0 }, { label: 'M', stock: 8 }, { label: 'L', stock: 12 }, { label: 'XL', stock: 2 }, { label: 'XXL', stock: 0 }],
    description: 'Radiate joy with the Sitara Kurta. Authentic micro-mirror framing surrounded by fine Gujarati resham hand-embroidery over lightweight flowing georgette.',
    fabricDetails: ['Viscose Georgette with Pure Santoon Lining', 'Genuine mirror glass embroidery with silk threads'],
    occasion: 'Haldi, mehendi and festive get-togethers.', care: ['Dry clean only.', 'Do not iron directly on mirror work.'],
    isNewArrival: false, isFeatured: true,
  },
  {
    name: 'Mogra Chiffon Saree', slug: 'mogra-chiffon-saree', code: 'SC-2025-077', category: 'Sarees',
    fabric: 'Hand-dyed Chiffon', badge: 'Editor’s Pick', price: 9800, mrp: 14000, images: img('mogra'),
    colors: [
      { name: 'Blush Ivory Ombré', hex: '#eedcd5' }, { name: 'Sage Green Ombré', hex: '#c5d3c1' },
      { name: 'Powder Sky Blue', hex: '#b8c9d9' }, { name: 'Pale Lavender', hex: '#d2c2d6' },
    ],
    sizeType: 'free', freeSizeStock: 5,
    sareeDetails: { sareeLength: '5.5 metres', blousePiece: 'Included (Unstitched)', blouseLength: '0.8 metres', blouseFabric: 'Embroidered Raw Silk' },
    description: 'Breezy and featherlight, Mogra features an ethereal ombré gradient dyed by masters in Jaipur, with hand-embroidered jasmine cutwork borders along the entire drape.',
    fabricDetails: ['Pure Silk Chiffon 60g high-grade yarn', 'Hand cutwork with silver-gilded cord work'],
    occasion: OCCASION, care: SAREE_CARE, isNewArrival: false, isFeatured: true,
  },
  {
    name: 'Rani Bagh Blouse', slug: 'rani-bagh-blouse', code: 'SC-2025-012', category: 'Blouses',
    fabric: 'Brocade & Pearl Tassels', badge: 'Atelier Signature', price: 6400, mrp: 8500, images: img('rani-bagh'),
    colors: [
      { name: 'Emerald Velvet', hex: '#143d2c' }, { name: 'Maroon Crimson', hex: '#580c1f' },
      { name: 'Royal Indigo', hex: '#192a56' }, { name: 'Burnished Gold', hex: '#b28938' },
    ],
    sizeType: 'sized', sizes: [{ label: '32', stock: 3 }, { label: '34', stock: 5 }, { label: '36', stock: 4 }, { label: '38', stock: 1 }, { label: '40', stock: 0 }],
    description: 'An exquisite statement blouse tailored in deep jewel-toned brocade. Embellished with handcrafted pearl tassel dori tie-backs and golden bullion piping.',
    fabricDetails: ['Handwoven Brocade Silk with cotton inner lining', 'Handmade cultured pearl drop latkans'],
    occasion: 'Pair with plain silk or organza sarees for weddings and receptions.', care: ['Dry clean only.'],
    isNewArrival: false, isFeatured: true,
  },
];
