defmodule ErrjordanWeb.BentoLive do
  use ErrjordanWeb, :live_view

  alias ErrjordanWeb.BentoRoute

  def mount(_params, _session, socket) do
    mc_views = BentoRoute.list_group(:mc)
    custom_views = BentoRoute.list_group(:custom)

    socket =
      socket
      |> assign(:sidebar_open?, true)
      |> assign(:mc_views, mc_views)
      |> assign(:custom_views, custom_views)
      |> assign(:current_route, BentoRoute.overview())
      |> assign(:content, %{})
      |> assign(:mode, "timeline")
      |> assign(:time_range, default_time_range())

    {:ok, socket}
  end

  def handle_params(params, url, socket) do
    current_path = URI.parse(url).path
    view_slug = params["view_slug"]
    time_range = parse_time_range(params) || socket.assigns.time_range || default_time_range()
    mode = params["mode"] || socket.assigns.mode || "timeline"

    case BentoRoute.fetch(view_slug) do
      {:ok, route} ->
        content = route.loader.(%{route: route, time_range: time_range, mode: mode})
        {:noreply,
         socket
         |> assign(:current_path, current_path)
         |> assign(:time_range, time_range)
         |> assign(:mode, mode)
         |> assign(:current_route, route)
         |> assign(:content, content)}

      {:error, :not_found} ->
        {:noreply, push_navigate(socket, to: ~p"/bento")}
    end
  end

  defp build_redirect_params(time_range, mode) do
    time_range = time_range || default_time_range()
    mode = mode || "timeline"

    build_full_params(time_range, mode)
  end

  defp build_full_params(time_range, mode) do
    %{
      "start" => Date.to_iso8601(time_range.start),
      "end" => Date.to_iso8601(time_range.end),
      "mode" => mode
    }
    |> URI.encode_query()
  end

  defp parse_time_range(%{"start" => start_str, "end" => end_str}) do
    with {:ok, start_date} <- Date.from_iso8601(start_str),
         {:ok, end_date} <- Date.from_iso8601(end_str) do
      %{start: start_date, end: end_date}
    else
      _ -> nil
    end
  end

  defp parse_time_range(_), do: nil

  defp default_time_range do
    today = Date.utc_today()

    %{
      start: Date.add(today, -30),
      end: today
    }
  end

  # Event handlers
  def handle_event("toggle_sidebar", _params, socket) do
    {:noreply, update(socket, :sidebar_open?, &(!&1))}
  end

  def handle_event("change_mode", %{"mode" => mode}, socket) do
    time_range = socket.assigns.time_range

    destination =
      case socket.assigns.current_route do
        %{group: :overview} -> build_overview_url(time_range, mode)
        route -> build_view_url(route, time_range, mode)
      end

    {:noreply,
     push_patch(socket,
       to: destination
     )}
  end

  # Help functions
  defp build_overview_url(time_range, mode) do
    range = time_range || default_time_range()
    mode = mode || "timeline"

    ~p"/bento?#{build_full_params(range, mode)}"
  end

  defp build_view_url(view, time_range, mode) do
    range = time_range || default_time_range()
    mode = mode || "timeline"

    ~p"/bento/#{view.slug}?#{build_full_params(range, mode)}"
  end

  attr :variant, :atom, values: [:desktop, :mobile], default: :desktop
  attr :mc_views, :list, required: true
  attr :custom_views, :list, required: true
  attr :current_route, :map, required: true
  attr :time_range, :map, default: nil
  attr :mode, :string, default: "timeline"

  def sidebar_content(assigns) do
    ~H"""
    <div class="flex h-full w-full flex-col justify-between">
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-end gap-2 p-3">
          <button
            type="button"
            phx-click="toggle_sidebar"
            class="inline-flex items-center bg-transparent rounded-sm active:bg-gray-200/90 p-2 text-gray-700 transition hover:bg-gray-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:hidden"
            aria-label="Close sidebar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
              class="size-6 fill-gray-500/80"
            >
              <path d="M6.83496 3.99992C6.38353 4.00411 6.01421 4.0122 5.69824 4.03801C5.31232 4.06954 5.03904 4.12266 4.82227 4.20012L4.62207 4.28606C4.18264 4.50996 3.81498 4.85035 3.55859 5.26848L3.45605 5.45207C3.33013 5.69922 3.25006 6.01354 3.20801 6.52824C3.16533 7.05065 3.16504 7.71885 3.16504 8.66301V11.3271C3.16504 12.2712 3.16533 12.9394 3.20801 13.4618C3.25006 13.9766 3.33013 14.2909 3.45605 14.538L3.55859 14.7216C3.81498 15.1397 4.18266 15.4801 4.62207 15.704L4.82227 15.79C5.03904 15.8674 5.31234 15.9205 5.69824 15.9521C6.01398 15.9779 6.383 15.986 6.83398 15.9902L6.83496 3.99992ZM18.165 11.3271C18.165 12.2493 18.1653 12.9811 18.1172 13.5702C18.0745 14.0924 17.9916 14.5472 17.8125 14.9648L17.7295 15.1415C17.394 15.8 16.8834 16.3511 16.2568 16.7353L15.9814 16.8896C15.5157 17.1268 15.0069 17.2285 14.4102 17.2773C13.821 17.3254 13.0893 17.3251 12.167 17.3251H7.83301C6.91071 17.3251 6.17898 17.3254 5.58984 17.2773C5.06757 17.2346 4.61294 17.1508 4.19531 16.9716L4.01855 16.8896C3.36014 16.5541 2.80898 16.0434 2.4248 15.4169L2.27051 15.1415C2.03328 14.6758 1.93158 14.167 1.88281 13.5702C1.83468 12.9811 1.83496 12.2493 1.83496 11.3271V8.66301C1.83496 7.74072 1.83468 7.00898 1.88281 6.41985C1.93157 5.82309 2.03329 5.31432 2.27051 4.84856L2.4248 4.57317C2.80898 3.94666 3.36012 3.436 4.01855 3.10051L4.19531 3.0175C4.61285 2.83843 5.06771 2.75548 5.58984 2.71281C6.17898 2.66468 6.91071 2.66496 7.83301 2.66496H12.167C13.0893 2.66496 13.821 2.66468 14.4102 2.71281C15.0069 2.76157 15.5157 2.86329 15.9814 3.10051L16.2568 3.25481C16.8833 3.63898 17.394 4.19012 17.7295 4.84856L17.8125 5.02531C17.9916 5.44285 18.0745 5.89771 18.1172 6.41985C18.1653 7.00898 18.165 7.74072 18.165 8.66301V11.3271ZM8.16406 15.995H12.167C13.1112 15.995 13.7794 15.9947 14.3018 15.9521C14.8164 15.91 15.1308 15.8299 15.3779 15.704L15.5615 15.6015C15.9797 15.3451 16.32 14.9774 16.5439 14.538L16.6299 14.3378C16.7074 14.121 16.7605 13.8478 16.792 13.4618C16.8347 12.9394 16.835 12.2712 16.835 11.3271V8.66301C16.835 7.71885 16.8347 7.05065 16.792 6.52824C16.7605 6.14232 16.7073 5.86904 16.6299 5.65227L16.5439 5.45207C16.32 5.01264 15.9796 4.64498 15.5615 4.3886L15.3779 4.28606C15.1308 4.16013 14.8165 4.08006 14.3018 4.03801C13.7794 3.99533 13.1112 3.99504 12.167 3.99504H8.16406C8.16407 3.99667 8.16504 3.99829 8.16504 3.99992L8.16406 15.995Z">
              </path>
            </svg>
            <span class="sr-only">Close sidebar</span>
          </button>
        </div>
        <ul class="rounded-box flex w-full flex-col px-4">
          <.sidebar_overview_item
            is_active={@current_route.group == :overview}
            time_range={@time_range}
            mode={@mode}
          />
        </ul>
        <ul class="group/sidebar-section justify-stretch flex w-full flex-col px-4">
          <.sidebar_menu_title label="MC Views" />
          <.sidebar_nav_item
            :for={view <- @mc_views}
            view={view}
            current_route={@current_route}
            time_range={@time_range}
            mode={@mode}
          />
        </ul>
        <ul class="group/sidebar-section justify-stretch flex w-full flex-col px-4">
          <.sidebar_menu_title label="Custom Views" />
          <.sidebar_nav_item
            :for={view <- @custom_views}
            view={view}
            current_route={@current_route}
            time_range={@time_range}
            mode={@mode}
          />
        </ul>
      </div>
      <div class="flex items-center justify-start gap-2 border-t border-gray-300 p-3">
        <div class="size-6.5 rounded-full bg-gray-300"></div>
        <div class="flex flex-col">
          <span class="text-[13px]/4 font-normal text-gray-600">username.lastname@example.com</span>
          <span class="text-[13px]/4 text-gray-400">Some info</span>
        </div>
      </div>
    </div>
    """
  end

  def render(assigns) do
    ~H"""
    <Layouts.app>
      <div id="bento-live" class="relative flex h-screen w-full overflow-hidden bg-white">
        <div class="grid h-full w-full md:grid-cols-[18rem_minmax(0,1fr)]">
          <aside
            id="bento-sidebar"
            class="hidden h-full overflow-y-auto border-r border-gray-200 bg-white md:block"
          >
            <.sidebar_content
              variant={:desktop}
              mc_views={@mc_views}
              custom_views={@custom_views}
              current_route={@current_route}
              time_range={@time_range}
              mode={@mode}
            />
          </aside>

          <section
            id="bento-main"
            class="relative flex h-full flex-col bg-white"
          >
            <div class="items-align flex gap-1 p-4">
              <button
                type="button"
                id="toggle-sidebar"
                phx-click="toggle_sidebar"
                class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition duration-200 hover:border-gray-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 md:hidden"
                aria-controls="bento-sidebar"
                aria-expanded={@sidebar_open?}
              >
                <.icon name="hero-bars-2" class="h-4 w-4" />
              </button>
            </div>
            <div class="flex-1 overflow-y-auto px-4 pb-6">
              <%= render_content(
                @current_route.component,
                %{
                  route: @current_route,
                  content: @content,
                  time_range: @time_range,
                  mode: @mode
                }
              ) %>
            </div>
          </section>
        </div>

        <div class={[
          "fixed inset-0 z-40 flex md:hidden",
          @sidebar_open? && "pointer-events-auto",
          not @sidebar_open? && "pointer-events-none"
        ]}>
          <button
            type="button"
            phx-click="toggle_sidebar"
            class={[
              "bg-gray-900/40 absolute inset-0 transition-opacity",
              @sidebar_open? && "opacity-100",
              not @sidebar_open? && "opacity-0"
            ]}
            aria-hidden="true"
            tabindex="-1"
          />

          <aside class={[
            "relative flex h-full w-80 max-w-full transform bg-gray-50 shadow-2xl transition-transform duration-300",
            @sidebar_open? && "translate-x-0",
            not @sidebar_open? && "-translate-x-full"
          ]}>
            <.sidebar_content
              variant={:mobile}
              mc_views={@mc_views}
              custom_views={@custom_views}
              current_route={@current_route}
              time_range={@time_range}
              mode={@mode}
            />
          </aside>
        </div>
      </div>
    </Layouts.app>
    """
  end

  defp sidebar_menu_title(assigns) do
    ~H"""
    <li
      class=" inline-flex cursor-pointer flex-row items-center gap-1 text-gray-400 py-2"
      disabled
    >
      <div class="flex w-full items-center justify-between" disabled>
        <span class="plex text-sm/6 font-medium uppercase tracking-widest text-gray-500 md:text-xs/6">
          {@label}
        </span>
        <button class="group inline-flex cursor-pointer items-center justify-center md:opacity-0 md:group-hover/sidebar-section:opacity-100 md:focus-visible:opacity-100">
          <.icon
            name="hero-plus-circle-solid"
            class="size-9 text-sky-400/90 active:text-sky-500 md:size-7 md:text-gray-300 md:group-hover:text-sky-400 md:group-active:text-sky-500"
          />
        </button>
      </div>
    </li>
    """
  end

  attr :is_active, :boolean, default: false
  attr :time_range, :map, default: nil
  attr :mode, :string, default: "timeline"

  defp sidebar_overview_item(assigns) do
    time_range = assigns.time_range || default_time_range()
    mode = assigns.mode || "timeline"
    is_active = assigns.is_active

    assigns =
      assigns
      |> assign(:navigate, build_overview_url(time_range, mode))
      |> assign(:parent_classes, [
        "w-full border-l border-transparent"
      ])
      |> assign(:link_classes, [
        "flex w-full items-center gap-2 rounded-md py-2 text-base md:text-sm",
        is_active && "text-gray-900 font-semibold",
        not is_active && "text-gray-500 hover:text-gray-900 font-normal"
      ])

    ~H"""
    <li class={@parent_classes}>
      <.link navigate={@navigate} class={@link_classes}>
        <span class="flex items-center gap-2">
          <.icon name="hero-squares-2x2" class="h-5 w-5" /> Overview
        </span>
      </.link>
    </li>
    """
  end

  attr :view, :map, required: true
  attr :current_route, :map, required: true
  attr :time_range, :map, default: nil
  attr :mode, :string, default: "timeline"

  defp sidebar_nav_item(assigns) do
    time_range = assigns.time_range || default_time_range()
    mode = assigns.mode || "timeline"
    current_route = assigns.current_route
    navigate = build_view_url(assigns.view, time_range, mode)

    is_active = current_route.id == assigns.view.id

    assigns =
      assigns
      |> assign(:navigate, navigate)
      |> assign(:is_active, is_active)
      |> assign(:parent_classes, [
        "w-full border-l",
        is_active && "border-gray-800",
        not is_active && "border-gray-300/90 hover:border-gray-500/90"
      ])
      |> assign(:link_classes, [
        "flex w-full items-center justify-between rounded-md pl-4 pr-0 py-2 text-md md:text-sm",
        is_active && "text-gray-800 font-semibold tracking-[0.0075em]",
        not is_active && "text-gray-500 hover:text-gray-800 font-normal tracking-wide"
      ])

    ~H"""
    <li class={@parent_classes}>
      <.link navigate={@navigate} class={@link_classes}>
        {@view.label}
      </.link>
    </li>
    """
  end

  defp render_content({module, function}, assigns) when is_atom(module) and is_atom(function) do
    apply(module, function, [assigns])
  end
end
