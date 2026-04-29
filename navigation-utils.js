function buildCourseNav(currentSlug, courses) {
  const items = Array.isArray(courses) ? courses : [];
  const index = items.findIndex((item) => item.slug === currentSlug);
  if (index === -1) {
    return { previous: null, next: null };
  }
  return {
    previous: index > 0 ? items[index - 1] : null,
    next: index < items.length - 1 ? items[index + 1] : null,
  };
}

module.exports = {
  buildCourseNav,
};
