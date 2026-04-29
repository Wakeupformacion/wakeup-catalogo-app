function buildCategoryChips(categories, activeCategory) {
  return (categories || []).map((item) => ({
    ...item,
    isActive: item.category_normalized === activeCategory,
  }));
}

module.exports = {
  buildCategoryChips,
};
