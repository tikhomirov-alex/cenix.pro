import puppeteer from 'puppeteer';
import axios from 'axios';
import * as fs from 'fs';

async function fetchProducts(categoryUrl) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    await page.goto(categoryUrl, { waitUntil: 'networkidle2' });

    // Получаем cookies
    const cookies = await page.cookies();
    const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    const apiUrl = 'https://www.vprok.ru/web/api/v1/catalog/category/7382?sort=popularity_desc&limit=30&page=1';
    const payload = {
        noRedirect: true,
        url: '/catalog/7382/pomidory-i-ovoschnye-nabory'
    };

    await page.setRequestInterception(true);

    let token = '';

    // Обработчик перехвата запросов
    page.on('request', request => {
        const headers = request.headers();
        if (headers['X-XSRF-TOKEN']) {
            token = headers['X-XSRF-TOKEN'];
        }
        request.continue();
    });

    try {
        // Выполнение запроса
        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookieString,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 YaBrowser/24.12.0.0 Safari/537.36',
                'X-XSRF-TOKEN': token
            }
        });

        return response.data;  // Возвращаем данные из ответа
    } catch (error) {
        console.error('Ошибка при выполнении API-запроса:', error.response ? error.response.data : error.message);
        throw error;
    } finally {
        await browser.close();
    }
}

function saveProductsToFile(products) {
    const output = products.map(product => {
        return `Название товара: ${product.name}\n` +
               `Ссылка на изображение: ${product.image}\n` +
               `Рейтинг: ${product.rating}\n` +
               `Количество отзывов: ${product.reviewCount}\n` +
               `Цена: ${product.price}\n` +
               `Акционная цена: ${product.salePrice || 'Нет'}\n` +
               `Цена до акции: ${product.oldPrice || 'Нет'}\n` +
               `Размер скидки: ${product.discount || 'Нет'}\n` +
               `\n`;
    }).join('');

    fs.writeFileSync('products-api.txt', output);
}

(async () => {
    // eslint-disable-next-line no-undef
    const categoryUrl = process.argv[2];
    if (!categoryUrl) {
        console.error('Необходимо указать ссылку на категорию товаров.');
        // eslint-disable-next-line no-undef
        process.exit(1);
    }

    try {
        const data = await fetchProducts(categoryUrl);
        if (!data || !data.products) {
            throw new Error('Не удалось получить данные о товарах');
        }
        const products = data.products;
        saveProductsToFile(products);
        console.log('Данные о товарах успешно сохранены в файл products-api.txt');
    } catch (error) {
        console.error('Ошибка при получении данных:', error);
    }
})();
