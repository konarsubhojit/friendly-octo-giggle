import { describe, it, expect } from "vitest";
import adminReducer, {
  clearAdminError,
  removeProduct,
  upsertProduct,
  selectAdminProducts,
  selectAdminOrders,
  selectAdminUsers,
  selectAdminProductsLoading,
  selectAdminOrdersLoading,
  selectAdminUsersLoading,
  selectAdminError,
} from "@/features/admin/store/adminSlice";

const initialState = {
  products: [],
  orders: [],
  users: [],
  productsLoading: false,
  ordersLoading: false,
  usersLoading: false,
  error: null,
};

describe("adminSlice reducer", () => {
  it("returns initial state", () => {
    expect(adminReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  it("clearAdminError sets error to null", () => {
    const state = { ...initialState, error: "Admin error" };
    expect(adminReducer(state, clearAdminError()).error).toBeNull();
  });
});

describe("removeProduct", () => {
  it("removes product by id", () => {
    const state = {
      ...initialState,
      products: [
        { id: "p1", name: "Product 1" },
        { id: "p2", name: "Product 2" },
      ] as never[],
    };
    const result = adminReducer(state, removeProduct("p1"));
    expect(result.products).toHaveLength(1);
    expect((result.products[0] as { id: string }).id).toBe("p2");
  });

  it("no-op for non-existent id", () => {
    const state = { ...initialState, products: [{ id: "p1" }] as never[] };
    const result = adminReducer(state, removeProduct("p999"));
    expect(result.products).toHaveLength(1);
  });
});

describe("upsertProduct", () => {
  it("updates existing product", () => {
    const state = {
      ...initialState,
      products: [{ id: "p1", name: "Old Name" }] as never[],
    };
    const result = adminReducer(
      state,
      upsertProduct({ id: "p1", name: "New Name" }),
    );
    expect(result.products).toHaveLength(1);
    expect((result.products[0] as { name: string }).name).toBe("New Name");
  });

  it("inserts new product at beginning", () => {
    const state = {
      ...initialState,
      products: [{ id: "p1", name: "Existing" }] as never[],
    };
    const result = adminReducer(
      state,
      upsertProduct({ id: "p2", name: "New" }),
    );
    expect(result.products).toHaveLength(2);
    expect((result.products[0] as { id: string }).id).toBe("p2");
  });
});

describe("adminSlice extraReducers", () => {
  it("sets productsLoading on fetchAdminProducts.pending", () => {
    const result = adminReducer(initialState, {
      type: "admin/fetchProducts/pending",
    });
    expect(result.productsLoading).toBe(true);
    expect(result.error).toBeNull();
  });

  it("sets products on fetchAdminProducts.fulfilled", () => {
    const products = [{ id: "p1" }];
    const result = adminReducer(initialState, {
      type: "admin/fetchProducts/fulfilled",
      payload: products,
    });
    expect(result.productsLoading).toBe(false);
    expect(result.products).toEqual(products);
  });

  it("sets error on fetchAdminProducts.rejected", () => {
    const result = adminReducer(initialState, {
      type: "admin/fetchProducts/rejected",
      payload: "Forbidden",
    });
    expect(result.productsLoading).toBe(false);
    expect(result.error).toBe("Forbidden");
  });

  it("sets ordersLoading on fetchAdminOrders.pending", () => {
    const result = adminReducer(initialState, {
      type: "admin/fetchOrders/pending",
    });
    expect(result.ordersLoading).toBe(true);
  });

  it("sets orders on fetchAdminOrders.fulfilled", () => {
    const orders = [{ id: "o1" }];
    const result = adminReducer(initialState, {
      type: "admin/fetchOrders/fulfilled",
      payload: orders,
    });
    expect(result.ordersLoading).toBe(false);
    expect(result.orders).toEqual(orders);
  });

  it("sets usersLoading on fetchAdminUsers.pending", () => {
    const result = adminReducer(initialState, {
      type: "admin/fetchUsers/pending",
    });
    expect(result.usersLoading).toBe(true);
  });

  it("sets users on fetchAdminUsers.fulfilled", () => {
    const users = [{ id: "u1", email: "a@b.com" }];
    const result = adminReducer(initialState, {
      type: "admin/fetchUsers/fulfilled",
      payload: users,
    });
    expect(result.usersLoading).toBe(false);
    expect(result.users).toEqual(users);
  });

  it("updates order in list on updateAdminOrderStatus.fulfilled", () => {
    const state = {
      ...initialState,
      orders: [{ id: "o1", status: "PENDING" }] as never[],
    };
    const result = adminReducer(state, {
      type: "admin/updateOrderStatus/fulfilled",
      payload: { id: "o1", status: "SHIPPED" },
    });
    expect((result.orders[0] as { status: string }).status).toBe("SHIPPED");
  });

  it("updates user in list on updateAdminUserRole.fulfilled", () => {
    const state = {
      ...initialState,
      users: [{ id: "u1", role: "USER" }] as never[],
    };
    const result = adminReducer(state, {
      type: "admin/updateUserRole/fulfilled",
      payload: { id: "u1", role: "ADMIN" },
    });
    expect((result.users[0] as { role: string }).role).toBe("ADMIN");
  });
});

describe("admin selectors", () => {
  const rootState = {
    cart: {} as never,
    orders: {} as never,
    wishlist: {} as never,
    admin: {
      ...initialState,
      products: [{ id: "p1" }] as never[],
      orders: [{ id: "o1" }] as never[],
      users: [{ id: "u1" }] as never[],
      productsLoading: true,
      ordersLoading: true,
      usersLoading: true,
      error: "admin err",
    },
  };

  it("selectAdminProducts", () => {
    expect(selectAdminProducts(rootState)).toEqual([{ id: "p1" }]);
  });

  it("selectAdminOrders", () => {
    expect(selectAdminOrders(rootState)).toEqual([{ id: "o1" }]);
  });

  it("selectAdminUsers", () => {
    expect(selectAdminUsers(rootState)).toEqual([{ id: "u1" }]);
  });

  it("selectAdminProductsLoading", () => {
    expect(selectAdminProductsLoading(rootState)).toBe(true);
  });

  it("selectAdminOrdersLoading", () => {
    expect(selectAdminOrdersLoading(rootState)).toBe(true);
  });

  it("selectAdminUsersLoading", () => {
    expect(selectAdminUsersLoading(rootState)).toBe(true);
  });

  it("selectAdminError", () => {
    expect(selectAdminError(rootState)).toBe("admin err");
  });
});
