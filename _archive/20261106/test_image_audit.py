"""Unit tests for the image-audit engine.

Exercises the verdict matrix (including the UNMAPPED classification fix),
relative/absolute path normalization, and duplicate detection. Tests are
deterministic: they run against the module functions directly, not the live
crawl.
"""
import importlib.util
import unittest

SPEC = importlib.util.spec_from_file_location("site_image_audit", "site-image-audit.py")
AUDIT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUDIT)

# Controlled catalog for deterministic verdict tests (filename -> entry).
AUDIT.METADATA_INDEX = {
    "man-walking-beach-zanzibar-sand.jpg": {"file": "man-walking-beach-zanzibar-sand.jpg"},
    "stone-town-ornate-carved-door-arch.jpg": {"file": "stone-town-ornate-carved-door-arch.jpg"},
}


def rec(url):
    return {"url": url, "currentSrc": url or "", "alt": "", "heading": "",
            "component": "", "className": "", "role": "hero"}


class VerdictMatrixTest(unittest.TestCase):
    """evaluate_image_identity must follow the documented evidence hierarchy."""

    def _eval(self, url, mapping=None):
        if mapping is None:
            mapping = {"entity": None, "entity_id": None, "entity_type": None,
                       "confidence": "LOW"}
        return AUDIT.evaluate_image_identity(rec(url), mapping)

    def test_entity_high_catalog_correct(self):
        url = "http://localhost:8080/assets/images/stone-town-ornate-carved-door-arch.jpg"
        m = {"entity": "stone-town-walking-tour", "entity_id": "x",
             "entity_type": "tour", "confidence": "HIGH"}
        self.assertEqual(self._eval(url, m)["verdict"], "CORRECT")

    def test_entity_high_external_host_uncertain(self):
        url = "http://cdn.evil.example/stone-town-ornate-carved-door-arch.jpg"
        m = {"entity": "stone-town-walking-tour", "entity_id": "x",
             "entity_type": "tour", "confidence": "HIGH"}
        self.assertEqual(self._eval(url, m)["verdict"], "UNCERTAIN")

    def test_entity_low_uncertain(self):
        url = "http://localhost:8080/assets/images/stone-town-ornate-carved-door-arch.jpg"
        m = {"entity": "stone-town-walking-tour", "entity_id": "x",
             "entity_type": "tour", "confidence": "LOW"}
        self.assertEqual(self._eval(url, m)["verdict"], "UNCERTAIN")

    def test_no_entity_catalog_unmapped(self):
        """The classification fix: catalog match with no entity => UNMAPPED."""
        url = "http://localhost:8080/assets/images/man-walking-beach-zanzibar-sand.jpg"
        self.assertEqual(self._eval(url)["verdict"], "UNMAPPED")

    def test_no_entity_external_host_uncertain(self):
        url = "http://cdn.evil.example/man-walking-beach-zanzibar-sand.jpg"
        self.assertEqual(self._eval(url)["verdict"], "UNCERTAIN")

    def test_no_entity_no_catalog_unresolved(self):
        url = "http://localhost:8080/assets/images/not-in-catalog.jpg"
        self.assertEqual(self._eval(url)["verdict"], "UNRESOLVED")

    def test_empty_url_unresolved(self):
        self.assertEqual(self._eval("")["verdict"], "UNRESOLVED")


class EntityMappingTest(unittest.TestCase):
    """map_image_to_entity path normalization."""

    def test_empty_url_returns_empty_mapping(self):
        m = AUDIT.map_image_to_entity(rec(""), {})
        self.assertIsNone(m["entity_id"])

    def test_slugmap_match(self):
        # slugMap maps stone-town-walking-tour -> stone-town-ornate-carved-door-arch.jpg
        m = AUDIT.map_image_to_entity(
            rec("/assets/images/stone-town-ornate-carved-door-arch.jpg"), {})
        self.assertEqual(m["entity_type"], "tour")
        self.assertEqual(m["confidence"], "HIGH")

    def test_bare_relative_resolution(self):
        # filename resolves via urljoin(BASE_URL, './x')
        m = AUDIT.map_image_to_entity(
            rec("assets/images/man-walking-beach-zanzibar-sand.jpg"), {})
        self.assertIsNotNone(m)


class DuplicateDetectionTest(unittest.TestCase):
    def test_duplicates_flagged(self):
        images = [
            {"url": "/a.jpg", "currentSrc": "/a.jpg"},
            {"url": "/a.jpg", "currentSrc": "/a.jpg"},
            {"url": "/b.jpg", "currentSrc": "/b.jpg"},
            {"url": "", "currentSrc": ""},
        ]
        meta = {}
        AUDIT.detect_duplicates(images, meta)
        self.assertEqual(images[0]["reuse_count"], 1)
        self.assertEqual(images[1]["reuse_count"], 1)
        self.assertEqual(images[1]["duplicate_of"], 0)
        self.assertEqual(images[2]["reuse_count"], 0)
        self.assertEqual(meta["duplicate_image_count"], 1)

    def test_no_duplicates(self):
        images = [{"url": "/a.jpg", "currentSrc": "/a.jpg"},
                  {"url": "/b.jpg", "currentSrc": "/b.jpg"}]
        meta = {}
        AUDIT.detect_duplicates(images, meta)
        self.assertNotIn("duplicate_image_count", meta)


if __name__ == "__main__":
    unittest.main()
