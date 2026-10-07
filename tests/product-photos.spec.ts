import { test, expect, type Page } from '@playwright/test';

test.describe('Add New Product - Product Photos Feature', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    // Navigate and login as Artisan
    await page.goto('/');
    await page.getByText('Quick Demo Login:').waitFor({ timeout: 10000 });
    await page.getByText('Rajesh Kumar').click();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=🎨 Artisan Portal', { timeout: 10000 });

    // Open Add New Product modal/form
    const addProductBtn = page.getByRole('button', { name: /Add New Product/i });
    await addProductBtn.click();
    await page.waitForSelector('text=🎨 Add New Product (Voice-Guided)', { timeout: 5000 });

    // Enter description to trigger AI story generation
    const textarea = page.locator('textarea');
    await textarea.fill('Handcrafted Blue Pottery Ceramic Vase from Jaipur with floral motifs and vibrant glaze.');
    // Wait for the story & form fields to render
    await page.waitForSelector('#photoInput', { timeout: 10000 });
  });

  test('validates empty photo URL input', async ({ page }: { page: Page }) => {
    const photoInput = page.locator('#photoInput');
    const addPhotoBtn = page.getByRole('button', { name: /Add Photo/i });

    // Click Add Photo with empty input
    await addPhotoBtn.click();

    // Verify error message is displayed
    await expect(page.getByText('Please enter an image URL or choose a file.')).toBeVisible();
  });

  test('validates invalid photo URL', async ({ page }: { page: Page }) => {
    const photoInput = page.locator('#photoInput');
    const addPhotoBtn = page.getByRole('button', { name: /Add Photo/i });

    // Type invalid URL
    await photoInput.fill('invalid-url-string');
    await addPhotoBtn.click();

    // Verify error message
    await expect(page.getByText(/Please enter a valid URL/i)).toBeVisible();
  });

  test('adds photo via button and clears input with preview', async ({ page }: { page: Page }) => {
    const photoInput = page.locator('#photoInput');
    const addPhotoBtn = page.getByRole('button', { name: /Add Photo/i });

    const testUrl = 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61';
    await photoInput.fill(testUrl);
    await addPhotoBtn.click();

    // Input should be cleared
    await expect(photoInput).toHaveValue('');

    // Count should be updated
    await expect(page.getByText(/✓ 1 photo\(s\) added/i)).toBeVisible();

    // Primary badge should appear on first photo
    await expect(page.getByText('Primary', { exact: true })).toBeVisible();

    // Image preview should be rendered
    const previewImg = page.locator('img[alt="Product 1"]');
    await expect(previewImg).toBeVisible();
  });

  test('supports adding photo via Enter key', async ({ page }: { page: Page }) => {
    const photoInput = page.locator('#photoInput');

    const testUrl = 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261';
    await photoInput.fill(testUrl);
    await photoInput.press('Enter');

    // Input should be cleared
    await expect(photoInput).toHaveValue('');

    // Photo should be added
    await expect(page.getByText(/✓ 1 photo\(s\) added/i)).toBeVisible();
  });

  test('allows adding multiple photos and removing specific photo', async ({ page }: { page: Page }) => {
    const photoInput = page.locator('#photoInput');
    const addPhotoBtn = page.getByRole('button', { name: /Add Photo/i });

    const photo1 = 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61';
    const photo2 = 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261';
    const photo3 = 'https://images.unsplash.com/photo-1582845512747-e42001c95638';

    // Add first photo
    await photoInput.fill(photo1);
    await addPhotoBtn.click();
    await expect(page.getByText(/✓ 1 photo\(s\) added/i)).toBeVisible();

    // Add second photo via Enter
    await photoInput.fill(photo2);
    await photoInput.press('Enter');
    await expect(page.getByText(/✓ 2 photo\(s\) added/i)).toBeVisible();

    // Add third photo
    await photoInput.fill(photo3);
    await addPhotoBtn.click();
    await expect(page.getByText(/✓ 3 photo\(s\) added/i)).toBeVisible();

    // Verify all 3 previews exist
    await expect(page.locator('img[alt="Product 1"]')).toBeVisible();
    await expect(page.locator('img[alt="Product 2"]')).toBeVisible();
    await expect(page.locator('img[alt="Product 3"]')).toBeVisible();

    // Remove photo 2
    const removePhoto2 = page.locator('button[aria-label="Remove photo 2"]');
    await removePhoto2.click();

    // Count should be updated to 2
    await expect(page.getByText(/✓ 2 photo\(s\) added/i)).toBeVisible();

    // Total preview images should now be 2
    const previewImages = page.locator('div.grid img');
    await expect(previewImages).toHaveCount(2);
  });

  test('provides choose image upload button with proper file acceptance', async ({ page }: { page: Page }) => {
    const chooseImageBtn = page.getByRole('button', { name: /Choose Image/i });
    await expect(chooseImageBtn).toBeVisible();

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp,image/jpg');
  });

  test('submits product with photos for QC Review successfully', async ({ page }: { page: Page }) => {
    const photoInput = page.locator('#photoInput');
    const addPhotoBtn = page.getByRole('button', { name: /Add Photo/i });

    const photoUrl = 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61';
    await photoInput.fill(photoUrl);
    await addPhotoBtn.click();
    await expect(page.getByText(/✓ 1 photo\(s\) added/i)).toBeVisible();

    // Handle dialog alert
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    // Click Submit for QC Review
    const submitBtn = page.getByRole('button', { name: /Submit for QC Review/i });
    await submitBtn.click();

    // Should return to dashboard and display the newly added product
    await expect(page.getByText('🎨 Add New Product (Voice-Guided)')).not.toBeVisible();
    await expect(page.getByText(/Welcome, Rajesh Kumar!/i)).toBeVisible();

    // Check that product with photo appears on dashboard
    const productCard = page.locator('.grid').filter({ hasText: /Handcrafted Blue Pottery/i }).first();
    await expect(productCard).toBeVisible();
  });
});
