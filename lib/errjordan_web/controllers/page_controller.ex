defmodule ErrjordanWeb.PageController do
  use ErrjordanWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end
