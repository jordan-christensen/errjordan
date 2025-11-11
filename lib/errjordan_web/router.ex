defmodule ErrjordanWeb.Router do
  use ErrjordanWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :put_root_layout, html: {ErrjordanWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  scope "/", ErrjordanWeb do
    pipe_through :browser

    get "/", PageController, :home
    live "/demo", DemoLive
    live "/perf", PerfLive
    live "/lab", LabLive, :index
    live "/bento", BentoLive
    live "/bento/:view_slug", BentoLive
  end

  scope "/", ErrjordanWeb do
    pipe_through :api

    get "/health", HealthController, :show
  end
end
