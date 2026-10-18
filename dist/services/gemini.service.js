"use strict";
// Stubbed Gemini Service
// In a real implementation, this would use google-generative-ai SDK
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeImages = void 0;
const analyzeImages = async (imageUrls) => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Randomize result for demonstration
    const conditions = ['Excellent', 'Good', 'Fair', 'Poor'];
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    let factor = 1.0;
    switch (condition) {
        case 'Excellent':
            factor = 1.2;
            break;
        case 'Good':
            factor = 1.0;
            break;
        case 'Fair':
            factor = 0.8;
            break;
        case 'Poor':
            factor = 0.6;
            break;
    }
    return {
        condition,
        factor,
        details: `AI analysis of ${imageUrls.length} images suggests the property is in ${condition} condition. Notable features include modern fixtures and good lighting.`
    };
};
exports.analyzeImages = analyzeImages;
