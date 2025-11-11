defmodule ErrjordanWeb.BentoRoute do
  @moduledoc """
  Declarative registry for every route rendered inside `BentoLive`.

  Each entry knows the slug, label, group that it belongs to (overview, MC,
  custom), the component responsible for rendering its content, and the loader
  that fetches or synthesizes data for that component.
  """

  alias ErrjordanWeb.BentoData
  alias ErrjordanWeb.BentoOverviewComponents
  alias ErrjordanWeb.BentoMCComponents
  alias ErrjordanWeb.BentoCustomComponents

  @type group :: :overview | :mc | :custom
  @type component_identifier :: {module(), atom()}
  @type loader_fun :: (map() -> map())

  @enforce_keys [:id, :slug, :label, :group, :component, :loader]
  defstruct [:id, :slug, :label, :group, :component, :loader, meta: %{}]

  @type t :: %__MODULE__{
          id: integer() | atom(),
          slug: String.t(),
          label: String.t(),
          group: group(),
          component: component_identifier(),
          loader: loader_fun(),
          meta: map()
        }

  @overview_data [
    %{
      id: :overview,
      slug: "overview",
      label: "Overview",
      group: :overview,
      component: {BentoOverviewComponents, :render},
      loader: &BentoData.load_overview/1
    }
  ]

  @mc_views_data [
    %{
      id: 1,
      slug: "helios",
      label: "HELIOS",
      group: :mc,
      component: {BentoMCComponents, :render},
      loader: &BentoData.load_mc_view/1,
      meta: %{mc_id: "helios"}
    },
    %{
      id: 2,
      slug: "curcio",
      label: "Curcio",
      group: :mc,
      component: {BentoMCComponents, :render},
      loader: &BentoData.load_mc_view/1,
      meta: %{mc_id: "curcio"}
    }
  ]

  @custom_views_data [
    %{id: 3, label: "Back Field, North 40, Boondocks, The Sticks", slug: "back-field"},
    %{id: 4, label: "Hillside", slug: "hillside"},
    %{id: 5, label: "East Asparagus", slug: "east-asparagus"},
    %{id: 6, label: "Section 4", slug: "section-4"},
    %{id: 7, label: "New Planting", slug: "new-planting"},
    %{id: 8, label: "Well #1 Area", slug: "well-1-area"},
    %{id: 9, label: "The Bottoms", slug: "the-bottoms"},
    %{id: 10, label: "Shop Block", slug: "shop-block"},
    %{id: 11, label: "North End (Drips)", slug: "north-end-drops"},
    %{id: 12, label: "Old Orchard", slug: "old-orchard"},
    %{id: 13, label: "Alfalfa", slug: "alfalfa"},
    %{id: 14, label: "Red Sector A", slug: "red-sector-a"}
  ]

  @spec all() :: [t()]
  def all, do: overview_routes() ++ mc_routes() ++ custom_routes()

  @spec overview() :: t()
  def overview, do: hd(overview_routes())

  @spec list_group(group()) :: [t()]
  def list_group(:overview), do: overview_routes()
  def list_group(:mc), do: mc_routes()
  def list_group(:custom), do: custom_routes()

  @spec fetch(String.t() | nil) :: {:ok, t()} | {:error, :not_found}
  def fetch(nil), do: {:ok, overview()}

  def fetch(slug) do
    all()
    |> Enum.find(&(&1.slug == slug))
    |> case do
      nil -> {:error, :not_found}
      route -> {:ok, route}
    end
  end

  defp overview_routes, do: structify(@overview_data)

  defp mc_routes, do: structify(@mc_views_data)

  defp custom_routes do
    @custom_views_data
    |> Enum.map(fn view ->
      Map.merge(view, %{
        group: :custom,
        component: {BentoCustomComponents, :render},
        loader: &BentoData.load_custom_view/1,
        meta: %{custom_id: view.id}
      })
    end)
    |> structify()
  end

  defp structify(items) do
    Enum.map(items, fn attrs ->
      attrs = Map.put_new(attrs, :meta, %{})
      struct(__MODULE__, attrs)
    end)
  end
end
