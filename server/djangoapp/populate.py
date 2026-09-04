from .models import CarMake, CarModel


def initiate():
    inventory = (
        {
            "make": "Nissan",
            "description": "Nissan Motors",
            "model": "Pathfinder",
            "dealer_id": 1,
            "type": CarModel.CarType.SUV,
            "year": 2023,
        },
        {
            "make": "Toyota",
            "description": "Toyota Motor Corporation",
            "model": "Camry",
            "dealer_id": 3,
            "type": CarModel.CarType.SEDAN,
            "year": 2022,
        },
    )

    for car in inventory:
        make, _ = CarMake.objects.update_or_create(
            name=car["make"],
            defaults={"description": car["description"]},
        )
        CarModel.objects.update_or_create(
            car_make=make,
            name=car["model"],
            dealer_id=car["dealer_id"],
            defaults={"type": car["type"], "year": car["year"]},
        )
