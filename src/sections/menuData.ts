// The menu as served (the café's printed menu, September 2026; bites from hartandground.yousual.app). Prices in pounds.
export type Item = { name: string; price: string; note?: string }
export type Group = { title?: string; items: Item[] }
export type Category = { id: string; title: string; sizes?: string; groups: Group[]; foot?: string }

export const DRINKS: Category[] = [
  {
    id: 'coffee', title: 'Coffee',
    groups: [{ items: [
      { name: 'Espresso', price: '2.60' }, { name: 'Macchiato', price: '2.80' }, { name: 'Flat White', price: '3.60' },
      { name: 'Americano', price: '3.20 / 3.50' }, { name: 'Cappuccino', price: '3.70' }, { name: 'Latte', price: '3.70' },
      { name: 'Mocha', price: '4.20 / 4.60' }, { name: 'Filter Coffee', price: '3.40 / 3.80' },
    ] }],
  },
  {
    id: 'iced-coffee', title: 'Cold & Iced Coffee', sizes: '16 oz',
    groups: [{ items: [
      { name: 'Iced Americano', price: '3.80' }, { name: 'Iced Latte', price: '4.20' }, { name: 'Iced Spanish Latte', price: '4.50' },
      { name: 'Iced Mocha', price: '4.50' }, { name: 'Cold Brew', price: '3.90' },
    ] }],
  },
  {
    id: 'matcha', title: 'Matcha Collection', sizes: 'Small hot / Medium hot / Iced',
    groups: [
      { title: 'Classic', items: [{ name: 'Pure Ceremonial Matcha', price: '4.00 / 4.50 / 5.00' }, { name: 'Ceremonial Matcha Latte', price: '4.20 / 4.70 / 5.20' }] },
      { title: 'Hart & Ground Signatures', items: [
        { name: 'Pistachio Matcha', price: '5.00 / 5.40 / 5.80' }, { name: 'Strawberry Cream Matcha', price: '4.30 / 5.20 / 5.60' },
        { name: 'Vanilla Cloud Matcha', price: '4.30 / 5.20 / 5.60' }, { name: 'Mango Matcha', price: '4.80 / 5.20 / 5.60' },
      ] },
      { title: 'Hart & Ground Special', items: [{ name: 'Collagen Matcha', price: '5.50 / 5.90 / 6.30', note: 'Ceremonial matcha, milk, collagen' }] },
    ],
  },
  {
    id: 'tea', title: 'Tea & Hot Drinks',
    groups: [{ items: [
      { name: 'All Types of Tea', price: '2.80' }, { name: 'Teapot', price: '5.00', note: 'Selection of teas available' },
      { name: 'Hot Chocolate', price: '3.80 / 4.20' }, { name: 'Spiced Chai', price: '4.20' },
    ] }],
  },
  {
    id: 'smoothies', title: 'Signature Smoothies',
    groups: [{ items: [{ name: 'Mango', price: '4.80' }, { name: 'Strawberry', price: '4.80' }, { name: 'Pineapple', price: '4.80' }] }],
  },
  {
    id: 'extras', title: 'Extras',
    groups: [{ items: [
      { name: 'Alternative Milk', price: '+ 0.50' }, { name: 'Extra Espresso Shot', price: '+ 0.60' },
      { name: 'Cold Foam', price: '+ 1.00', note: 'Vanilla or cardamom' },
    ] }],
  },
]

export const BITES: Category[] = [
  {
    id: 'pastries', title: 'Pastries & Sweets',
    groups: [{ items: [
      { name: 'Plain Croissant', price: '3.20' }, { name: 'Pain au Chocolat', price: '3.50' }, { name: 'Almond Croissant', price: '3.80' },
      { name: 'Cinnamon Bun', price: '4.00' }, { name: 'Pistachio Danish', price: '4.20' },
    ] }],
  },
  {
    id: 'bagels', title: 'Bagels & Toast',
    groups: [{ items: [{ name: 'Cheese Toast', price: '4.00' }, { name: 'Egg Bagel', price: '4.50' }, { name: 'Tuna & Avocado Bagel', price: '4.85' }] }],
  },
  {
    id: 'desserts', title: 'Desserts',
    groups: [{ items: [
      { name: 'Chocolate Cake', price: '3.00' }, { name: 'Arabian Kunafa', price: '7.00' }, { name: 'Mini Pancake Box', price: '7.00' },
      { name: 'San Sebastián Cheesecake', price: '7.00' },
    ] }],
  },
]
