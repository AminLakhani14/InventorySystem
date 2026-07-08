import { Request, Response } from 'express';
import https from 'https';
import Product from '../models/Product';
import type { AuthRequest } from '../middleware/auth';
import { buildTenantFilter, getTenantObjectId } from '../utils/tenancy';

interface OpenFoodFactsProduct {
    code?: string;
    product_name?: string;
    product_name_en?: string;
    generic_name?: string;
    generic_name_en?: string;
    brands?: string;
    countries?: string;
    image_front_url?: string;
    image_front_small_url?: string;
    image_url?: string;
    selected_images?: {
        front?: {
            display?: Record<string, string>;
            small?: Record<string, string>;
        };
    };
}

type ProductImageSource =
    | 'openfoodfacts'
    | 'openbeautyfacts'
    | 'openproductsfacts'
    | 'openpetfoodfacts';

interface ProductImageSuggestion {
    id: string;
    title: string;
    brand: string;
    imageUrl: string;
    thumbnailUrl: string;
    source: ProductImageSource;
    subtitle: string;
    score: number;
}

interface OpenFactsSourceConfig {
    source: ProductImageSource;
    searchBaseUrl: string;
}

const OPEN_FACTS_SOURCES: OpenFactsSourceConfig[] = [
    {
        source: 'openfoodfacts',
        searchBaseUrl: 'https://world.openfoodfacts.org/cgi/search.pl',
    },
    {
        source: 'openbeautyfacts',
        searchBaseUrl: 'https://world.openbeautyfacts.org/cgi/search.pl',
    },
    {
        source: 'openproductsfacts',
        searchBaseUrl: 'https://world.openproductsfacts.org/cgi/search.pl',
    },
    {
        source: 'openpetfoodfacts',
        searchBaseUrl: 'https://world.openpetfoodfacts.org/cgi/search.pl',
    },
];

const CATEGORY_SOURCE_PRIORITY: Record<string, ProductImageSource[]> = {
    'Snacks & Candy': ['openfoodfacts', 'openproductsfacts', 'openbeautyfacts', 'openpetfoodfacts'],
    'Gum & Mints': ['openfoodfacts', 'openproductsfacts', 'openbeautyfacts', 'openpetfoodfacts'],
    Groceries: ['openfoodfacts', 'openproductsfacts', 'openbeautyfacts', 'openpetfoodfacts'],
    'Health & Personal': ['openbeautyfacts', 'openproductsfacts', 'openfoodfacts', 'openpetfoodfacts'],
    Accessories: ['openproductsfacts', 'openbeautyfacts', 'openfoodfacts', 'openpetfoodfacts'],
    General: ['openproductsfacts', 'openfoodfacts', 'openbeautyfacts', 'openpetfoodfacts'],
};

const SOURCE_MATCH_KEYWORDS: Record<ProductImageSource, string[]> = {
    openfoodfacts: [
        'chips', 'snack', 'cookie', 'cookies', 'drink', 'juice', 'soda', 'cola', 'water',
        'candy', 'chocolate', 'gum', 'mint', 'biscuit', 'oreo', 'lays', 'pepsi', 'coke',
        'milk', 'bread', 'rice', 'noodle', 'tea', 'coffee', 'energy', 'redbull', 'bull',
    ],
    openbeautyfacts: [
        'soap', 'shampoo', 'conditioner', 'lotion', 'cream', 'face', 'skin', 'hair',
        'toothpaste', 'brush', 'deodorant', 'sanitizer', 'dettol', 'cosmetic', 'beauty',
        'makeup', 'serum', 'wash',
    ],
    openproductsfacts: [
        'charger', 'cable', 'usb', 'adapter', 'headphone', 'headphones', 'speaker', 'battery',
        'light', 'bulb', 'phone', 'case', 'mouse', 'keyboard', 'toy', 'remote', 'electronics',
        'accessory', 'accessories',
    ],
    openpetfoodfacts: [
        'pet', 'dog', 'cat', 'puppy', 'kitten', 'treat', 'treats', 'kibble', 'litter',
    ],
};

const SOURCE_BOOSTS: Record<ProductImageSource, number> = {
    openfoodfacts: 16,
    openbeautyfacts: 16,
    openproductsfacts: 16,
    openpetfoodfacts: 16,
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = <T>(url: string, timeoutMs = 8000) =>
    new Promise<T>((resolve, reject) => {
        const request = https.get(
            url,
            {
                headers: {
                    'User-Agent': 'ItemHive/1.0 image-suggestions',
                    Accept: 'application/json',
                },
            },
            (response) => {
                const chunks: Buffer[] = [];

                response.on('data', (chunk) => {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                });

                response.on('end', () => {
                    const body = Buffer.concat(chunks).toString('utf8');

                    if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
                        reject(new Error(`Open Food Facts request failed with ${response.statusCode || 'unknown status'}`));
                        return;
                    }

                    try {
                        resolve(JSON.parse(body) as T);
                    } catch {
                        reject(new Error('Open Food Facts returned invalid JSON'));
                    }
                });
            }
        );

        request.on('error', (error) => reject(error));
        request.setTimeout(timeoutMs, () => {
            request.destroy(new Error('Open Food Facts request timed out'));
        });
    });

const fetchJsonWithRetry = async <T>(url: string, retries = 2) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await fetchJson<T>(url);
        } catch (error: any) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < retries) {
                await delay(350 * (attempt + 1));
            }
        }
    }

    throw lastError || new Error('Unable to fetch remote JSON');
};

const normalizeText = (value: string) =>
    value
        .toLowerCase()
        .replace(/[^a-z0-9]+/gi, ' ')
        .trim();

const tokenize = (value: string) =>
    normalizeText(value)
        .split(' ')
        .map((token) => token.trim())
        .filter(Boolean);

const getQueryMatchMeta = (query: string, product: OpenFoodFactsProduct) => {
    const queryText = normalizeText(query);
    const uniqueQueryTokens = [...new Set(tokenize(query))];
    const titleText = normalizeText(
        [
            product.product_name,
            product.product_name_en,
            product.generic_name,
            product.generic_name_en,
        ]
            .filter(Boolean)
            .join(' ')
    );
    const brandText = normalizeText(product.brands || '');
    const candidateText = normalizeText(`${titleText} ${brandText}`);
    const titleTokens = new Set(tokenize(titleText));
    const brandTokens = new Set(tokenize(brandText));
    const uniqueMatchedCount = uniqueQueryTokens.filter((token) => titleTokens.has(token) || brandTokens.has(token)).length;
    const exactPhraseInTitle = queryText.length > 0 && titleText.includes(queryText);
    const exactPhraseInBrand = queryText.length > 0 && brandText.includes(queryText);
    const exactPhraseInCandidate = queryText.length > 0 && candidateText.includes(queryText);
    const allTokensMatched = uniqueQueryTokens.length > 0 && uniqueMatchedCount === uniqueQueryTokens.length;

    return {
        queryText,
        queryTokens: uniqueQueryTokens,
        titleText,
        brandText,
        candidateText,
        uniqueMatchedCount,
        exactPhraseInTitle,
        exactPhraseInBrand,
        exactPhraseInCandidate,
        allTokensMatched,
    };
};

const scoreSuggestion = (query: string, product: OpenFoodFactsProduct, source: ProductImageSource, category = '') => {
    const {
        queryText,
        queryTokens,
        titleText,
        brandText,
        candidateText,
        uniqueMatchedCount,
        exactPhraseInTitle,
        exactPhraseInBrand,
        exactPhraseInCandidate,
        allTokensMatched,
    } = getQueryMatchMeta(query, product);

    if (!titleText) {
        return -1;
    }

    if (queryTokens.length >= 2 && !exactPhraseInTitle && !exactPhraseInBrand && !exactPhraseInCandidate && !allTokensMatched) {
        return -1;
    }

    let score = 0;

    if (titleText === queryText) {
        score += 220;
    } else if (exactPhraseInTitle) {
        score += 170;
    }

    if (exactPhraseInBrand) {
        score += 140;
    }

    if (exactPhraseInCandidate) {
        score += 90;
    }

    if (allTokensMatched) {
        score += 110;
    }

    for (const token of queryTokens) {
        if (titleText.includes(token)) {
            score += 18;
        }
        if (brandText.includes(token)) {
            score += 14;
        }
        if (candidateText.includes(token)) {
            score += 6;
        }
    }

    score += uniqueMatchedCount * 24;

    if (queryTokens.length >= 2 && uniqueMatchedCount < queryTokens.length) {
        score -= 45;
    }

    if (product.image_front_url) {
        score += 24;
    }

    if (product.image_front_small_url) {
        score += 8;
    }

    if (product.countries) {
        score += 4;
    }

    const normalizedCategory = normalizeText(category);
    const sourceKeywords = SOURCE_MATCH_KEYWORDS[source];
    const sourceKeywordMatched = queryTokens.some((token) => sourceKeywords.includes(token));
    const preferredSources = CATEGORY_SOURCE_PRIORITY[category] || CATEGORY_SOURCE_PRIORITY.General;
    const categoryPriorityIndex = preferredSources.indexOf(source);

    if (sourceKeywordMatched) {
        score += SOURCE_BOOSTS[source];
    }

    if (categoryPriorityIndex >= 0) {
        score += Math.max(0, 18 - categoryPriorityIndex * 6);
    }

    if (normalizedCategory === 'health personal' && source === 'openbeautyfacts') {
        score += 10;
    }

    if (normalizedCategory === 'accessories' && source === 'openproductsfacts') {
        score += 10;
    }

    return score;
};

const mapSuggestion = (
    product: OpenFoodFactsProduct,
    query: string,
    source: ProductImageSource,
    category = ''
): ProductImageSuggestion | null => {
    const imageUrl =
        product.selected_images?.front?.display?.en ||
        Object.values(product.selected_images?.front?.display || {})[0] ||
        product.image_front_url ||
        product.image_url;
    const thumbnailUrl =
        product.selected_images?.front?.small?.en ||
        Object.values(product.selected_images?.front?.small || {})[0] ||
        product.image_front_small_url ||
        imageUrl ||
        '';

    if (!imageUrl) {
        return null;
    }

    const title =
        product.product_name ||
        product.product_name_en ||
        product.generic_name ||
        product.generic_name_en ||
        'Product image';
    const brand = product.brands?.split(',')[0]?.trim() || 'Unknown brand';
    const subtitle = [brand, product.countries].filter(Boolean).join(' - ');
    const score = scoreSuggestion(query, product, source, category);

    if (score < 0) {
        return null;
    }

    return {
        id: `${source}-${product.code || `${title}-${brand}`.replace(/\s+/g, '-').toLowerCase()}`,
        title,
        brand,
        imageUrl,
        thumbnailUrl,
        source,
        subtitle,
        score,
    };
};

const buildSearchUrl = (source: OpenFactsSourceConfig, name: string) => {
    const searchUrl = new URL(source.searchBaseUrl);
    searchUrl.searchParams.set('search_terms', name);
    searchUrl.searchParams.set('search_simple', '1');
    searchUrl.searchParams.set('action', 'process');
    searchUrl.searchParams.set('json', '1');
    searchUrl.searchParams.set('page_size', '16');
    searchUrl.searchParams.set(
        'fields',
        [
            'code',
            'product_name',
            'product_name_en',
            'generic_name',
            'generic_name_en',
            'brands',
            'countries',
            'image_front_url',
            'image_front_small_url',
            'image_url',
            'selected_images',
        ].join(',')
    );
    return searchUrl.toString();
};

const getSourcePlan = (query: string, category: string) => {
    const preferredSources = CATEGORY_SOURCE_PRIORITY[category] || CATEGORY_SOURCE_PRIORITY.General;
    const queryTokens = tokenize(query);

    return OPEN_FACTS_SOURCES
        .map((sourceConfig) => {
            const keywordBoost = queryTokens.some((token) => SOURCE_MATCH_KEYWORDS[sourceConfig.source].includes(token)) ? 10 : 0;
            const categoryPriority = preferredSources.indexOf(sourceConfig.source);
            return {
                ...sourceConfig,
                rank: (categoryPriority >= 0 ? categoryPriority : preferredSources.length) - keywordBoost,
            };
        })
        .sort((a, b) => a.rank - b.rank);
};

const fetchSourceSuggestions = async (
    sourceConfig: OpenFactsSourceConfig,
    query: string,
    category: string
) => {
    const data = await fetchJsonWithRetry<{ products?: OpenFoodFactsProduct[] }>(buildSearchUrl(sourceConfig, query));
    return (data.products || [])
        .map((product) => mapSuggestion(product, query, sourceConfig.source, category))
        .filter((suggestion): suggestion is ProductImageSuggestion => Boolean(suggestion));
};

export const getProducts = async (req: AuthRequest, res: Response) => {
    try {
        const products = await Product.find(buildTenantFilter(req.user!)).sort({ name: 1 });
        res.json(products);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getProductById = async (req: AuthRequest, res: Response) => {
    try {
        const product = await Product.findOne({ id: req.params.id, ...buildTenantFilter(req.user!) });
        if (!product) return res.status(404).json({ message: 'Product not found' });
        res.json(product);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const getProductImageSuggestions = async (req: Request, res: Response) => {
    const name = String(req.query.name || '').trim();
    const category = String(req.query.category || '').trim();

    if (name.length < 2) {
        return res.status(400).json({ message: 'Product name must be at least 2 characters long' });
    }

    try {
        const sourcePlan = getSourcePlan(name, category);
        const settledResults = await Promise.allSettled(
            sourcePlan.map((sourceConfig) => fetchSourceSuggestions(sourceConfig, name, category))
        );

        const successfulSuggestions = settledResults
            .filter((result): result is PromiseFulfilledResult<ProductImageSuggestion[]> => result.status === 'fulfilled')
            .flatMap((result) => result.value);

        const dedupedSuggestions = Array.from(
            new Map(
                successfulSuggestions.map((suggestion) => [
                    `${normalizeText(suggestion.title)}|${normalizeText(suggestion.brand)}|${suggestion.imageUrl}`,
                    suggestion,
                ])
            ).values()
        );

        const suggestions = dedupedSuggestions
            .sort((a, b) => b.score - a.score)
            .slice(0, 4)
            .map(({ score, ...suggestion }) => suggestion);

        if (suggestions.length === 0) {
            const rejectionMessages = settledResults
                .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
                .map((result) => result.reason?.message)
                .filter(Boolean);

            if (rejectionMessages.length === settledResults.length) {
                return res.status(502).json({
                    message: 'Unable to fetch product image suggestions right now',
                    details: rejectionMessages[0],
                });
            }
        }

        return res.json({
            query: name,
            category,
            suggestions,
        });
    } catch (error: any) {
        return res.status(502).json({
            message: 'Unable to fetch product image suggestions right now',
            details: error.message,
        });
    }
};

export const createProduct = async (req: AuthRequest, res: Response) => {
    try {
        const product = new Product({
            ...req.body,
            price: req.body.salePrice ?? req.body.price,
            businessId: getTenantObjectId(req.user!),
            businessName: req.user?.businessName || '',
        });
        const savedProduct = await product.save();
        res.status(201).json(savedProduct);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
    try {
        const updatedProduct = await Product.findOneAndUpdate(
            { id: req.params.id, ...buildTenantFilter(req.user!) },
            {
                ...req.body,
                price: req.body.salePrice ?? req.body.price,
            },
            { new: true, runValidators: true }
        );
        if (!updatedProduct) return res.status(404).json({ message: 'Product not found' });
        res.json(updatedProduct);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
    try {
        const deletedProduct = await Product.findOneAndDelete({ id: req.params.id, ...buildTenantFilter(req.user!) });
        if (!deletedProduct) return res.status(404).json({ message: 'Product not found' });
        res.json({ message: 'Product deleted successfully' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
