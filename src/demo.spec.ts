import { beforeEach, describe, expect, it } from "vitest"
import type { TodoItem } from "./components/types"

describe("sum test", () => {
	it("adds 1 + 2 to equal 3", () => {
		expect(1 + 2).toBe(3)
	})
})

describe("todo functionality", () => {
	let todos: TodoItem[] = []
	let removed_id: number | null = null

	const toggle_todo = (id: number) => {
		todos = todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo))
	}

	const remove_todo = (id: number) => {
		removed_id = id
		todos = todos.filter((todo) => todo.id !== id)
	}

	beforeEach(() => {
		todos = [
			{ id: 1, text: "Buy milk", done: false },
			{ id: 2, text: "Walk dog", done: true },
		]
		removed_id = null
	})

	it("toggles todo completion status", () => {
		toggle_todo(1)
		expect(todos.find((t) => t.id === 1)?.done).toBe(true)

		toggle_todo(1)
		expect(todos.find((t) => t.id === 1)?.done).toBe(false)
	})

	it("removes todo item", () => {
		remove_todo(2)
		expect(todos.length).toBe(1)
		expect(removed_id).toBe(2)
		expect(todos.find((t) => t.id === 2)).toBeUndefined()
	})
})
