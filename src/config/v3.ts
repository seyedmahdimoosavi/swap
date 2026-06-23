// V3 contract addresses, ABIs and constants — ported verbatim from the
// original DotOneSwap single-file frontend (V3 full implementation).

export const EXPLORER_BASE = 'https://dotscan.one';

// V3 Contract Addresses
export const V3_POSITION_MANAGER = '0xC654F0f0A88d3f7249a4e1278A334b2467D9792C';
export const V3_SWAP_ROUTER = '0xcebb5A06c76EB885f1eAC6B4B72B202dB1c729A4';
export const V3_QUOTER = '0x68194B4f93ed1bCF178D8431883E7bC766Be5931';

// V3 ABIs
export const V3_SWAP_ROUTER_ABI = [
  'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)',
  'function exactInput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum) params) external payable returns (uint256 amountOut)',
  'function multicall(bytes[] calldata data) external payable returns (bytes[] memory results)',
];

export const V3_POSITION_MANAGER_ABI = [
  'function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function increaseLiquidity(tuple(uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) external payable returns (uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function decreaseLiquidity(tuple(uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline) params) external payable returns (uint256 amount0, uint256 amount1)',
  'function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) external payable returns (uint256 amount0, uint256 amount1)',
  'function burn(uint256 tokenId) external payable',
  'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
  'function tokenURI(uint256 tokenId) external view returns (string)',
  'function approve(address to, uint256 tokenId) external',
  'function factory() external view returns (address)',
  'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)',
  // Events (needed so PositionManager.interface.parseLog can decode mint receipts)
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
];

export const V3_QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)',
  'function quoteExactInput(bytes memory path, uint256 amountIn) external returns (uint256 amountOut)',
  'function quoteExactOutputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountOut, uint160 sqrtPriceLimitX96) external returns (uint256 amountIn)',
  'function quoteExactOutput(bytes memory path, uint256 amountOut) external returns (uint256 amountIn)',
];

export const V3_FACTORY_ABI_EX = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
];

export const V3_POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
  'function tickSpacing() external view returns (int24)',
];

// Tick math constants
export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

// Fee tier -> tick spacing
export const TICK_SPACING: Record<number, number> = { 100: 1, 500: 10, 3000: 60, 10000: 200 };

// sqrtPriceX96 valid bounds
export const MIN_SQRT_RATIO = '4295128739';
export const MAX_SQRT_RATIO = '1461446703485210103287273052203988822378723970342';
