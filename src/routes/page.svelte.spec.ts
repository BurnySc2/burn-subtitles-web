import { page } from "@vitest/browser/context"
import { describe, expect, it } from "vitest"
import { render } from "vitest-browser-svelte"
import Page from "./+page.svelte"

describe("/+page.svelte", () => {
	it("should render h1", async () => {
		render(Page)

		const heading = page.getByRole("heading", { level: 1 })
		await expect.element(heading).toBeInTheDocument()
	})

	it("should add a todo", async () => {
		render(Page)

		const input = page.getByPlaceholder("Add a new task...")
		const add_button = page.getByRole("button", { name: "Add" })

		await input.fill("Test todo")
		await add_button.click()

		const todo_item = page.getByText("Test todo")
		await expect.element(todo_item).toBeInTheDocument()
	})

	it("should toggle todo completion", async () => {
		render(Page)

		const input = page.getByPlaceholder("Add a new task...")
		const add_button = page.getByRole("button", { name: "Add" })

		await input.fill("Test todo")
		await add_button.click()

		const checkbox = page.getByRole("checkbox")
		await checkbox.click()
		await expect.element(checkbox).toBeChecked()
	})

	it("should remove a todo", async () => {
		render(Page)

		const input = page.getByPlaceholder("Add a new task...")
		const add_button = page.getByRole("button", { name: "Add" })

		await input.fill("Test todo")
		await add_button.click()

		const remove_button = page.getByRole("button", { name: "Remove" })
		await remove_button.click()

		await expect.element(page.getByText("Test todo")).not.toBeInTheDocument()
	})

	it("should filter todos", async () => {
		render(Page)

		const input = page.getByPlaceholder("Add a new task...")
		const add_button = page.getByRole("button", { name: "Add" })

		// Add two todos - one completed, one not
		await input.fill("Todo 1")
		await add_button.click()
		await page.getByRole("checkbox").click() // Mark first as done

		await input.fill("Todo 2")
		await add_button.click()

		// Test 'done' filter
		await page.getByRole("button", { name: "done" }).click()
		await expect.element(page.getByText("Todo 1")).toBeInTheDocument()
		await expect.element(page.getByText("Todo 2")).not.toBeInTheDocument()

		// Test 'todo' filter
		await page.getByRole("button", { name: "todo" }).click()
		await expect.element(page.getByText("Todo 2")).toBeInTheDocument()
		await expect.element(page.getByText("Todo 1")).not.toBeInTheDocument()

		// Test 'all' filter
		await page.getByRole("button", { name: "all" }).click()
		await expect.element(page.getByText("Todo 1")).toBeInTheDocument()
		await expect.element(page.getByText("Todo 2")).toBeInTheDocument()
	})

	it("should show completion count", async () => {
		render(Page)

		const input = page.getByPlaceholder("Add a new task...")
		const add_button = page.getByRole("button", { name: "Add" })

		await input.fill("Todo 1")
		await add_button.click()
		await page.getByRole("checkbox").click()

		await input.fill("Todo 2")
		await add_button.click()

		const count_text = page.getByText("1/2 completed")
		await expect.element(count_text).toBeInTheDocument()
	})
})
