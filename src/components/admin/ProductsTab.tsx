import React, { memo } from "react";

interface ProductsTabProps {
  AdminProductsTable: React.ComponentType<any>;
  products: any[];
  minRatingFilter: number;
  setMinRatingFilter: (val: number) => void;
  productApprovalFilter: string;
  setProductApprovalFilter: (val: string) => void;
  productSortBy: string;
  setProductSortBy: (val: string) => void;
  productSearchTerm: string;
  setProductSearchTerm: (val: string) => void;
  selectedProductIds: string[];
  setSelectedProductIds: (val: string[] | ((prev: string[]) => string[])) => void;
  handleBatchDeleteProducts: () => void;
  isBatchDeletingProducts: boolean;
  setProducts: (val: any) => void;
  setEditingProduct: (val: any) => void;
  setHasColorsEdit: (val: boolean) => void;
  setSelectedColorsEdit: (val: any) => void;
  setShowEditModal: (val: boolean) => void;
  deleteProduct: (id: string) => void;
  setSelectedProductForRejection: (val: any) => void;
  setProductRejectionReasonInput: (val: string) => void;
  confirmingApproveProductId: string | null;
  setConfirmingApproveProductId: (val: string | null) => void;
  productsPage?: number;
  hasMoreProducts?: boolean;
  isProductsLoading?: boolean;
  onNextProductsPage?: () => void;
  onPrevProductsPage?: () => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = memo(({
  AdminProductsTable,
  products,
  minRatingFilter,
  setMinRatingFilter,
  productApprovalFilter,
  setProductApprovalFilter,
  productSortBy,
  setProductSortBy,
  productSearchTerm,
  setProductSearchTerm,
  selectedProductIds,
  setSelectedProductIds,
  handleBatchDeleteProducts,
  isBatchDeletingProducts,
  setProducts,
  setEditingProduct,
  setHasColorsEdit,
  setSelectedColorsEdit,
  setShowEditModal,
  deleteProduct,
  setSelectedProductForRejection,
  setProductRejectionReasonInput,
  confirmingApproveProductId,
  setConfirmingApproveProductId,
  productsPage,
  hasMoreProducts,
  isProductsLoading,
  onNextProductsPage,
  onPrevProductsPage,
}) => {
  return (
    <div className="space-y-6">
      <AdminProductsTable
        products={products}
        minRatingFilter={minRatingFilter}
        setMinRatingFilter={setMinRatingFilter}
        productApprovalFilter={productApprovalFilter}
        setProductApprovalFilter={setProductApprovalFilter}
        productSortBy={productSortBy}
        setProductSortBy={setProductSortBy}
        productSearchTerm={productSearchTerm}
        setProductSearchTerm={setProductSearchTerm}
        selectedProductIds={selectedProductIds}
        setSelectedProductIds={setSelectedProductIds}
        handleBatchDeleteProducts={handleBatchDeleteProducts}
        isBatchDeletingProducts={isBatchDeletingProducts}
        setProducts={setProducts}
        setEditingProduct={setEditingProduct}
        setHasColorsEdit={setHasColorsEdit}
        setSelectedColorsEdit={setSelectedColorsEdit}
        setShowEditModal={setShowEditModal}
        deleteProduct={deleteProduct}
        setSelectedProductForRejection={setSelectedProductForRejection}
        setProductRejectionReasonInput={setProductRejectionReasonInput}
        confirmingApproveProductId={confirmingApproveProductId}
        setConfirmingApproveProductId={setConfirmingApproveProductId}
        productsPage={productsPage}
        hasMoreProducts={hasMoreProducts}
        isProductsLoading={isProductsLoading}
        onNextProductsPage={onNextProductsPage}
        onPrevProductsPage={onPrevProductsPage}
      />
    </div>
  );
});

export default ProductsTab;
