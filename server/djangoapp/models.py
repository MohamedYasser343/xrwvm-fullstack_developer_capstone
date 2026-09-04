from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class CarMake(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=500)

    def __str__(self):
        return self.name


class CarModel(models.Model):
    class CarType(models.TextChoices):
        SEDAN = "Sedan", "Sedan"
        SUV = "SUV", "SUV"
        WAGON = "Wagon", "Wagon"

    car_make = models.ForeignKey(
        CarMake,
        on_delete=models.CASCADE,
        related_name="car_models",
    )
    # Dealers live in the external Express service, so only its identifier is stored.
    dealer_id = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    name = models.CharField(max_length=100)
    type = models.CharField(
        max_length=10,
        choices=CarType.choices,
        default=CarType.SEDAN,
    )
    year = models.IntegerField(
        default=2023,
        validators=[MinValueValidator(2015), MaxValueValidator(2023)],
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("car_make", "name", "dealer_id"),
                name="unique_car_model_per_dealer",
            ),
        ]

    def __str__(self):
        return self.name
