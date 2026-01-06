const sharp = require('sharp');
const fs = require('fs');

async function createIcon() {
    const svgBuffer = fs.readFileSync('icon.svg');
    
    // Создаем PNG 256x256
    await sharp(svgBuffer)
        .resize(256, 256)
        .png()
        .toFile('icon.png');
    
    console.log('PNG created!');
    
    // Конвертируем в ICO используя динамический импорт
    const pngToIco = (await import('png-to-ico')).default;
    const icoBuffer = await pngToIco('icon.png');
    fs.writeFileSync('icon.ico', icoBuffer);
    
    console.log('ICO created successfully!');
}

createIcon().catch(console.error);
