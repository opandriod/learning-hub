Restore + Google Search Console fix bundle

Base used: learning_hub_project_store_play_style_v3_actual_full.zip

Included fixes:
- Restores full Learning Hub project folder.
- Replaces all SEO placeholder URLs with https://only-learninghub.site.
- Fixes public/robots.txt sitemap URL.
- Fixes public/sitemap.xml URLs.
- Adds sitemap link in index.html.
- Keeps Vercel SPA rewrite but excludes robots.txt, sitemap.xml, llms.txt and image assets.
- Adds Rewards to desktop sidebar if missing.

After push:
1. Confirm Vercel latest deployment succeeds.
2. Visit https://only-learninghub.site/robots.txt and https://only-learninghub.site/sitemap.xml.
3. In Google Search Console, inspect https://only-learninghub.site/ and request indexing.
4. Submit sitemap: https://only-learninghub.site/sitemap.xml

If Search Console asks for google-site-verification meta tag, paste that exact tag into learning-hub-frontend/index.html before pushing again.
