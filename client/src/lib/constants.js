import allCollections from '../../images_for_ShopbyCategory/all_collections.jpg';
import sarees from '../../images_for_ShopbyCategory/sarees.jpg';
import lehengas from '../../images_for_ShopbyCategory/lehengas.jpg';
import kurtis from '../../images_for_ShopbyCategory/kurtis.jpg';
import leggings from '../../images_for_ShopbyCategory/leggings.jpg';
import tops from '../../images_for_ShopbyCategory/tops.jpg';
import coOrdSets from '../../images_for_ShopbyCategory/co_ord_sets.jpg';
import dresses3Pcs from '../../images_for_ShopbyCategory/dresses_3pcs.jpg';
import frocks from '../../images_for_ShopbyCategory/frocks.jpg';
import nightDresses from '../../images_for_ShopbyCategory/night_dresses.jpg';
import bambooNightDresses from '../../images_for_ShopbyCategory/bamboo_night_dresses.jpg';

// Category copy and fallback tile photos come from the local Shop by Category image set.
export const CATEGORIES = [
  { key: 'Sarees', label: 'Sarees', singular: 'Saree', blurb: 'Classic silhouettes', img: sarees },
  { key: 'Lehengas', label: 'Lehengas', singular: 'Lehenga', blurb: 'Festive favorites', img: lehengas },
  { key: 'Kurti', label: 'Kurti', singular: 'Kurti', blurb: 'Everyday elegance', img: kurtis },
  { key: 'Leggings', label: 'Leggings', singular: 'Leggings', blurb: 'Comfort and style', img: leggings },
  { key: 'Tops', label: 'Tops', singular: 'Top', blurb: 'Minimal essentials', img: tops },
  { key: 'Co-Ord sets', label: 'Co-Ord sets', singular: 'Co-Ord set', blurb: 'Matching separates', img: coOrdSets },
  { key: 'Dresses(3-pcs)', label: 'Dresses(3-pcs)', singular: 'Dress(3-pcs)', blurb: 'Set styling', img: dresses3Pcs },
  { key: 'Frocks', label: 'Frocks', singular: 'Frock', blurb: 'Light and playful', img: frocks },
  { key: 'Night dresses', label: 'Night dresses', singular: 'Night dress', blurb: 'Soft comfort', img: nightDresses },
  { key: 'Bamboo night dresses', label: 'Bamboo night dresses', singular: 'Bamboo night dress', blurb: 'Breathable lounge', img: bambooNightDresses },
];

export const ALL_COLLECTIONS_TILE = {
  key: 'all',
  label: 'All collections',
  blurb: 'Complete curation',
  img: allCollections,
};

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);
export const categoryMeta = (key) => CATEGORIES.find((c) => c.key === key) || { key, label: key, singular: key, blurb: '' };

export const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
export const BLOUSE_PIECE_OPTIONS = ['Included (Unstitched)', 'Included (Stitched)', 'Not included'];

export const ADMIN_BASE = '/adminDivya';

// Laptop/desktop content width (phones are unaffected: every class is md: and up).
export const DESK = 'md:max-w-6xl md:mx-auto md:w-full md:px-8';
export const ADESK = 'md:max-w-6xl md:mx-auto md:w-full md:px-8';
