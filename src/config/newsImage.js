const sharp = require('sharp');
const supabase = require('./supabase');
const crypto = require('crypto');

const BUCKET = 'news-images';

async function processAndUpload(buffer) {
    const processed = await sharp(buffer)
        .rotate()
        .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();

    const filePath = `news/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.webp`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, processed, {
            contentType: 'image/webp',
            cacheControl: '3600',
            upsert: false,
        });

    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    return data.publicUrl;
}

module.exports = { processAndUpload };