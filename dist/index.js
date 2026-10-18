"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
exports.app = app;
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const listing_routes_1 = __importDefault(require("./routes/listing.routes"));
const noah_routes_1 = __importDefault(require("./routes/noah.routes"));
app.use('/api', auth_routes_1.default);
app.use('/api', listing_routes_1.default);
app.use('/api', noah_routes_1.default);
// Basic route
app.get('/', (req, res) => {
    res.send('Valyou Backend is running');
});
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = __importDefault(require("./swagger"));
app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.default));
// Serve static files for uploaded images (future proofing)
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
