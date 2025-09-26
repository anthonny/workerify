import { h, render } from "nano-jsx";
import { ViewTodo, ViewTodos } from "./templates";
import type { Renderer } from "./types";

const renderer: Renderer = {
	viewTodo: ({ todo, filter }) => {
		return render(<ViewTodo todo={todo} filter={filter} />).outerHTML;
	},
	viewTodos: ({ todos, filter }) => {
		return render(<ViewTodos todos={todos} filter={filter} />).outerHTML;
	},
};

export default renderer;
